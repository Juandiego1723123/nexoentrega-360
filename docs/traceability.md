# Matriz de trazabilidad

Requerimiento → Historia → SPEC → criterio → tarea → módulo → prueba → resultado. Generada por `scripts/generar-trazabilidad.py` a partir de `specs/*/spec.json` y `evidence/tests/`. La columna PR se completa en el documento de entrega al fusionar cada rama.

| Req. | HU | SPEC | Criterios | Tarea | Módulo | Prueba | Resultado |
|---|---|---|---|---|---|---|---|
| RF01 | HU-01 | SPEC-1 | AC-RF01-01, AC-RF01-02, AC-RF01-03, AC-RF01-04 | T-01 | apps/api/src/middleware/auth.js (login, logout, autenticar) | tests/integration/spec1-identidad.test.js | 4/4 pasan |
| RF02 | HU-01 | SPEC-1 | AC-RF02-01, AC-RF02-02, AC-RF02-03, AC-RF02-04, AC-RF02-05 | T-02 | apps/api/src/services/requests.js (loadForUser, exigirDueno) | tests/integration/spec1-identidad.test.js | 5/5 pasan |
| RF03 | HU-02 | SPEC-2 | AC-RF03-01, AC-RF03-02, AC-RF03-03, AC-RF03-04, AC-RF03-05 | T-03 | apps/api/src/validate.js; services/requests.js (crear, enviar) | tests/integration/spec2-solicitudes.test.js; tests/unit/validate.test.js | 5/5 pasan |
| RF04 | HU-02 | SPEC-2 | AC-RF04-01, AC-RF04-02, AC-RF04-03, AC-RF04-04 | T-04 | apps/api/src/services/requests.js (TRANSITIONS) | tests/integration/spec2-solicitudes.test.js | 4/4 pasan |
| RF05 | HU-03 | SPEC-3 | AC-RF05-01, AC-RF05-02, AC-RF05-03 | T-05 | apps/api/src/services/requests.js (reservar, bloquearInventario) | tests/integration/spec3-inventario.test.js | 3/3 pasan |
| RF06 | HU-03 | SPEC-3 | AC-RF06-01, AC-RF06-02, AC-RF06-03 | T-06 | apps/api/src/services/requests.js (transicionConInventario) | tests/integration/spec3-inventario.test.js | 3/3 pasan |
| RF07 | HU-03 | SPEC-3 | AC-RF07-01, AC-RF07-02, AC-RF07-03, AC-RF07-03b, AC-RF07-04, AC-RF07-05 | T-07 | apps/api/src/services/requests.js (reservar); tabla idempotency_keys | tests/integration/spec3-inventario.test.js | 6/6 pasan |
| RF08 | HU-04 | SPEC-4 | AC-RF08-01, AC-RF08-02, AC-RF08-03, AC-RF08-04, AC-RF08-05 | T-08 | apps/api/src/services/requests.js (listar, dashboard, inventario) | tests/integration/spec4-consultas.test.js | 5/5 pasan |
| RF09 | HU-04 | SPEC-4 | AC-RF09-01, AC-RF09-02, AC-RF09-03, AC-RF09-04, AC-RF09-05 | T-09 | services/requests.js (audit, auditoria); trigger en migrations/001_init.sql | tests/integration/spec4-consultas.test.js | 5/5 pasan |
| RF10 | HU-05 | SPEC-5 | AC-RF10-01, AC-RF10-02, AC-RF10-03, AC-RF10-04, AC-RF10-05 | T-10 | apps/api/src/services/ai.js (crearResumen) | tests/integration/spec5-ia.test.js | 5/5 pasan |
| RF11 | HU-05 | SPEC-5 | AC-RF11-01, AC-RF11-02, AC-RF11-03 | T-11 | apps/api/src/ai/validator.js; ai/schema.json | tests/integration/spec5-ia.test.js; tests/unit/ai.test.js | 3/3 pasan |
| RF12 | HU-05 | SPEC-5 | AC-RF12-01, AC-RF12-02 | T-12 | apps/api/src/services/ai.js (conLimite, aprobar); ai/fallback.js | tests/integration/spec5-ia.test.js | 2/2 pasan |
| RNF01 | HU-01 | SPEC-1 | AC-RNF01-01 | T-13 | apps/api/src/middleware/auth.js; validate.js | tests/integration/spec1-identidad.test.js | 1/1 pasan |
| RNF02 | HU-03 | SPEC-3 | AC-RNF02-01 | T-14 | CHECK en migrations/001_init.sql; services/requests.js | tests/integration/spec3-inventario.test.js | 1/1 pasan |
| RNF03 | HU-04 | SPEC-4 | AC-RNF03-01 | T-15 | índices en migrations/001_init.sql | tests/load/listados.k6.js | 1/1 pasan |
| RNF04 | — | Todas | transversal | T-16 | docker-compose.yml; Dockerfile; docs/runbook.md | docs/runbook.md (clon limpio) | — |
| RNF05 | — | Todas | transversal | T-17 | apps/web/src | tests/e2e/flujo-principal.spec.js (1366 y 390 px) | — |
| RNF06 | HU-05 | SPEC-5 | AC-RNF06-01 | T-18 | middleware/correlation.js; app.js (/health, /ready); ai/providers.js | tests/integration/spec5-ia.test.js | 1/1 pasan |
