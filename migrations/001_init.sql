-- NexoEntrega 360 · esquema inicial (PostgreSQL 16)
-- Fuente: SPEC-1 a SPEC-5. Las reglas críticas se repiten aquí como restricciones (defensa en profundidad).

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id    TEXT PRIMARY KEY,                       -- ORG-A, ORG-B
  name  TEXT NOT NULL,
  code_prefix TEXT NOT NULL UNIQUE,             -- A, B (códigos A-001, B-001)
  next_request_number INTEGER NOT NULL DEFAULT 1 CHECK (next_request_number >= 1)
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organizations(id),
  email         VARCHAR(120) NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('SOLICITANTE','COORDINADOR','BODEGA','AUDITOR')),
  password_hash TEXT NOT NULL                   -- bcrypt; nunca texto plano (AC-RF01-04)
);

CREATE TABLE sessions (
  token_hash  CHAR(64) PRIMARY KEY,             -- SHA-256 del token; el token solo viaja en la cookie
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_sessions_user ON sessions(user_id);

CREATE TABLE products (
  id      SERIAL PRIMARY KEY,
  org_id  TEXT NOT NULL REFERENCES organizations(id),
  sku     TEXT NOT NULL,
  name    TEXT NOT NULL,
  active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (org_id, sku)
);

CREATE TABLE inventory (
  product_id  INTEGER PRIMARY KEY REFERENCES products(id),
  on_hand     INTEGER NOT NULL,
  reserved    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT ck_inventory_on_hand  CHECK (on_hand >= 0),
  CONSTRAINT ck_inventory_reserved CHECK (reserved >= 0),
  CONSTRAINT ck_inventory_disponible CHECK (reserved <= on_hand)
);

CREATE TABLE requests (
  code           TEXT PRIMARY KEY,              -- A-001, B-001 ...
  org_id         TEXT NOT NULL REFERENCES organizations(id),
  requester_id   INTEGER NOT NULL REFERENCES users(id),
  zona           TEXT NOT NULL CHECK (zona IN ('NORTE','SUR','CENTRO','ORIENTE','OCCIDENTE')),
  prioridad      TEXT NOT NULL CHECK (prioridad IN ('NORMAL','ALTA')),
  fecha_requerida TIMESTAMPTZ NOT NULL,
  observaciones  VARCHAR(500),
  estado         TEXT NOT NULL DEFAULT 'BORRADOR'
                 CHECK (estado IN ('BORRADOR','ENVIADA','RESERVADA','DESPACHADA','ENTREGADA','CANCELADA')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at   TIMESTAMPTZ
);
CREATE INDEX ix_requests_org_estado   ON requests(org_id, estado);
CREATE INDEX ix_requests_org_created  ON requests(org_id, created_at DESC);
CREATE INDEX ix_requests_requester    ON requests(requester_id, created_at DESC);

CREATE TABLE request_lines (
  request_code TEXT NOT NULL REFERENCES requests(code) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  cantidad     INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 500),
  PRIMARY KEY (request_code, product_id)       -- impide SKU repetidos en una solicitud
);

CREATE TABLE idempotency_keys (
  idem_key      UUID NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  operation     TEXT NOT NULL,
  request_hash  CHAR(64) NOT NULL,
  status_code   INTEGER,
  response_body JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours',
  PRIMARY KEY (idem_key, user_id, operation)
);

CREATE TABLE audit_events (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        INTEGER NOT NULL REFERENCES users(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  recurso         TEXT NOT NULL,
  recurso_id      TEXT NOT NULL,
  accion          TEXT NOT NULL,
  fecha_utc       TIMESTAMPTZ NOT NULL DEFAULT now(),
  correlation_id  TEXT NOT NULL
);
CREATE INDEX ix_audit_org_fecha ON audit_events(organization_id, fecha_utc DESC);

-- Historial de solo inserción (RF09): ni la API ni un UPDATE/DELETE directo pueden alterarlo.
CREATE FUNCTION audit_events_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events es de solo inserción' USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER tr_audit_events_inmutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_inmutable();

CREATE TABLE ai_summaries (
  id              SERIAL PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id),
  coordinator_id  INTEGER NOT NULL REFERENCES users(id),
  request_ids     TEXT[] NOT NULL,
  origen          TEXT NOT NULL CHECK (origen IN ('IA','DETERMINISTA')),
  motivo_fallo    TEXT,                          -- se guarda el motivo, nunca el texto enviado al modelo
  summary         VARCHAR(600) NOT NULL,
  recommendations JSONB NOT NULL,
  estado          TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','APROBADO')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  approved_by     INTEGER REFERENCES users(id)
);
