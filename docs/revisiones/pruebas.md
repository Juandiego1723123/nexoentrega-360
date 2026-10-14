# Revisión del módulo pruebas – Juan Diego Edna (en ausencia de Juan Diego Muñoz)

Archivos revisados: tests/e2e/flujo-principal.spec.js, tests/integration/, docs/test-report.md

Lo que está bien:
- 62 pruebas (12 unitarias y 50 de integración contra PostgreSQL real) y 10 E2E en 1366 y 390 px; las 56 AC tienen prueba y el CI lo verifica.
- E2E-04 comprueba el aislamiento por los dos lados: ORG-B ve B-001 y no A-001 en la interfaz, y /api/requests/A-001 desde su sesión responde 404.
- El reporte registra 7 defectos (D-01 a D-07) con causa y corrección; D-05 fue una condición de carrera real del formulario que detectó el CI, y D-06 un spec.json desactualizado.

Lo que mejoraría:
- E2E-04 podría probar también la navegación directa a la URL del detalle de A-001 desde la interfaz, no solo la llamada a la API.
- D-05 muestra que las E2E deben esperar a que carguen los datos; conviene revisar las demás con esa regla.

Conclusión: de acuerdo con entregar el módulo así.

Uso de IA: el borrador de esta revisión lo generó Claude; lo verifiqué abriendo los archivos mencionados.
