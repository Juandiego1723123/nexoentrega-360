# Reporte de pruebas

## Entorno de ejecución

| Dato | Valor |
|---|---|
| Hardware | Linux, 2 vCPU Intel Xeon @ 2.80 GHz, 7 GB RAM |
| Software | Node.js 22.22.0; PostgreSQL 16.15; Chromium de Playwright 1.56.1; k6 0.54.0 |
| Fecha | 14 de octubre de 2026 |
| Datos | Seed del anexo (`seeds/seed-data.json`) reiniciado antes de cada escenario; carga con 2.000 solicitudes (`npm run seed:load`) |

## Comandos y resultados

| Comando | Resultado | Evidencia |
|---|---|---|
| `npm run check` | 5 spec.json coinciden; 24 operaciones del contrato = rutas; 56 criterios con prueba | salida de CI |
| `npm test` | 62 de 62 pasan (12 unitarias y 50 de integración contra PostgreSQL real, en 5 suites); ≈ 74 s | `evidence/tests/pruebas-unitarias-integracion.txt` |
| `npm run test:e2e` | 10 de 10 pasan (5 escenarios en 1366 y 390 px) | `evidence/tests/pruebas-e2e.txt`, `evidence/tests/e2e-results.json`, `evidence/screenshots/` (20 capturas) |
| `k6 run tests/load/listados.k6.js` | Fase de medición (60 s, 20 VU, tras 5 s): p95 52,4 ms; 0 % errores; 36.724 peticiones | `evidence/tests/k6-output.txt`, `evidence/tests/k6-summary.json` |

## Oráculos

Los valores esperados vienen del anexo `acceptance-oracles.md` (por ejemplo, reservar A-001 deja físico 10, reservado 7, disponible 3) y se comprueban con consultas directas a la base, no con la respuesta de la API.

## Defectos encontrados durante la construcción

| # | Defecto | Dónde | Corrección | Regresión |
|---|---|---|---|---|
| D-01 | La prueba de rutas sin sesión enviaba cuerpo en peticiones GET | `tests/integration/spec1-identidad.test.js` | Cuerpo solo en métodos que lo admiten | AC-RNF01-01 |
| D-02 | La prueba de teclado presionaba Tab antes de que el formulario cargara | `tests/e2e/flujo-principal.spec.js` | Esperar el campo Correo visible antes de Tab | E2E-03 |
| D-03 | En 390 px la celda incluye su etiqueta visual en el nombre accesible y la prueba buscaba el texto exacto | `tests/e2e/flujo-principal.spec.js` | Localizar por columna (`data-label`) | E2E-01 |
| D-04 | El Dockerfile usaba `npm ci --omit=optional` y excluía `@rollup/rollup-linux-x64-gnu`; `vite build` fallaba dentro de la imagen | `Dockerfile` | `npm ci --ignore-scripts` sin omitir opcionales | `docker compose up -d --build` (62 s hasta ready) |
| D-05 | Condición de carrera en el formulario: al llegar el catálogo se reemplazaban las líneas y se perdía la cantidad ya escrita (detectado por el CI en E2E-02, escritorio; intermitente) | `apps/web/src/Solicitudes.jsx` | Al cargar el catálogo solo se completa el SKU vacío; la prueba espera la opción de producto antes de escribir | E2E-02 |
| D-06 | Al dividir AC-RF07-05 en 05, 06 y 07 se editó `spec.md` sin regenerar `spec.json` ni agregar las pruebas; el CI #10 lo detectó (`DIFERENCIA: spec-3 spec.json no coincide`) | `specs/spec-3-inventario/`, `tests/integration/spec3-inventario.test.js` | `spec.json` regenerado y prueba separada en tres (commit eb4467a) | AC-RF07-05, AC-RF07-06, AC-RF07-07 |
| D-07 | Los supuestos 1, 3 y 8 del registro de aclaraciones se editaron de forma que contradecían SPEC-2 y el código (zona por dirección, visibilidad de inventario para solicitantes) | `docs/clarification-log.md` | Se restauraron los supuestos vigentes que cita SPEC-2 | Revisión manual contra SPEC-2 y `services/requests.js` |

Ningún defecto se resolvió relajando una aserción.

## Verificación manual (14-oct-2026, Juan Diego Edna, Windows + Docker Desktop)

| Verificación | Resultado |
|---|---|
| Arranque desde clon limpio con Docker | 62 s hasta `/api/ready` = 200 |
| Ataques entre organizaciones en el navegador (Coordinador ORG-A) | Leer B-001 → 404; reservar B-001 → 404; auditoría → 403; reserva sin clave → 422 |
| Teclado e indicación de errores | Foco visible al navegar con Tab; mensaje de credenciales incorrectas junto al formulario |
| Inyección en observaciones | El texto `<script>…` se muestra literal y no se ejecuta |
