# Bitácora de intervenciones de IA

La salida de la IA es solo una propuesta; la decisión y la verificación son del equipo. Cada integrante agrega su fila con un uso real y el enlace al commit o PR donde quedó el resultado. No se registran respuestas de IA como decisiones del cliente.

## IA-01 · Reconstrucción del código a partir de las SPECS (14-oct-2026)

| Campo | Registro |
|---|---|
| Integrante | Juan Diego Edna |
| Herramienta, proveedor y modelo | Claude (Anthropic), sesión en claude.ai; identificador configurado `claude-opus-5-5` |
| Contexto | La implementación previa del equipo no quedó versionada en un repositorio. Se pidió reconstruir el sistema completo siguiendo el documento del equipo (SPEC-1 a SPEC-5, ADR-01 a 04) y los anexos oficiales del examen (fixture-scenarios, ai-provider-fixtures, ai-output.schema, acceptance-oracles). |
| Prompt (resumen) | «Si no está el código, hagamos el código de nuevo para subirlo al repositorio», con el documento del equipo como especificación. |
| Salida relevante | API Express + PostgreSQL 16, interfaz React, 5 spec.md con exportador `--check`, contrato OpenAPI de 24 operaciones, 60 pruebas unitarias y de integración, 10 E2E, prueba k6, CI y Docker Compose. |
| Defectos detectados al ejecutar | (1) una prueba enviaba cuerpo en peticiones GET; (2) la prueba E2E de teclado presionaba Tab antes de que cargara el formulario; (3) en 390 px las celdas incluyen su etiqueta visual en el nombre accesible, por lo que la prueba buscaba el texto exacto equivocado. Los tres se corrigieron en las pruebas, sin relajar las aserciones. |
| Cambios respecto al documento previo | AC-RF05-01 y AC-RF07-03 usan los oráculos del anexo (A-001 de 7 unidades: 10/7/3); se agregaron AC-RF07-03b, AC-RF07-05, AC-RF09-05 y AC-RNF06-01; enviar acepta el contenido final del formulario. |
| Decisión | _Completar por el equipo tras revisar los PR_ |
| Verificación humana | _Completar: quién revisó qué módulo, contra qué SPEC, y enlace al PR_ |

## IA-02 a IA-06 · Una fila por integrante

| # | Integrante | Contexto | Prompt (resumen) | Salida relevante | Decisión (aceptada / ajustada / rechazada) | Verificación humana | Commit o PR |
|---|---|---|---|---|---|---|---|
| IA-02 | Andrés David López Muñoz | Revisión de SPECS | | | | | |
| IA-03 | Jhonatan David Yepes Luna | Reserva, idempotencia y datos | | | | | |
| IA-04 | David Yepes Cañas | Adaptador de IA, Docker y CI | | | | | |
| IA-05 | Juan Fernando Jiménez Benjumea | Interfaz y accesibilidad | | | | | |
| IA-06 | Juan Diego Muñoz | Casos de prueba adversariales | | | | | |
