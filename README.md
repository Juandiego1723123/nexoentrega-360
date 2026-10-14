# NexoEntrega 360

Distribución comunitaria de kits con Spec Driven Development e IA con revisión humana.
Segundo examen práctico · Arquitectura de Software (5917 · T01) · Universidad Simón Bolívar · 2026-2.

**Equipo VEYRON:** Andrés David López Muñoz, Juan Diego Edna, Juan Fernando Jiménez Benjumea, Juan Diego Muñoz, David Yepes Cañas, Jhonatan David Yepes Luna.

## Qué hace

Dos organizaciones aisladas (ORG-A, ORG-B), cuatro roles (solicitante, coordinador, bodega, auditor), flujo completo de una solicitud (borrador → enviada → reservada → despachada → entregada, con cancelación), reserva atómica e idempotente, auditoría inmutable y un asistente de IA que propone borradores que el coordinador aprueba, con degradación a un resumen determinista.

## Inicio rápido

```bash
cp .env.example .env
docker compose up -d --build        # http://localhost:3000
```

Sin Docker: `npm ci && npm run build && npm run migrate && npm run seed && npm start` (requiere PostgreSQL 16). Detalle, rollback y recuperación en [docs/runbook.md](docs/runbook.md).

Cuentas ficticias: `org-a-solicitante@example.test`, `org-a-coordinador@example.test`, `org-a-bodega@example.test`, `org-a-auditor@example.test` y sus equivalentes `org-b-…`, más `org-a-solicitante2@example.test`. Contraseña: valor de `SEED_PASSWORD` (por defecto `NexoDemo2026!`).

## Estructura

| Ruta | Contenido |
|---|---|
| `specs/*/spec.md` → `spec.json` | Fuente única de las 5 SPECS; `python3 scripts/export_specs.py --check` |
| `contracts/openapi.yaml` | Contrato HTTP (24 operaciones); `npm run contract:check` |
| `migrations/`, `seeds/` | Esquema PostgreSQL y escenario del anexo |
| `apps/api` | Node.js 22 + Express 4.21.2, pg 8.13.1, bcryptjs 2.4.3, Ajv 8.17.1 |
| `apps/web` | React 18.3.1 + Vite 5.4.11 |
| `tests/` | unitarias, integración contra PostgreSQL, E2E Playwright 1.56.1, carga k6 0.54.0 |
| `docs/` | constitución, aclaraciones, ADR, runbook, trazabilidad, SPEC vs código, riesgos, reporte de pruebas |
| `evidence/` | bitácora de IA, capturas 1366/390 px, resultados de pruebas |

## Verificación

```bash
npm run check      # specs, contrato y trazabilidad (54 criterios → pruebas)
npm test           # 60 pruebas (TEST_DATABASE_URL)
npm run test:e2e   # 10 pruebas E2E
```
