# SPEC-5 · Asistente de IA

| Campo | Valor |
|---|---|
| Versión | v1.0 |
| Historia | HU-05 |
| Como | coordinador |
| Quiero | un resumen asistido por IA de hasta 20 solicitudes ENVIADA |
| Para | priorizar mi revisión sabiendo que es un borrador que yo apruebo |
| Requisitos | RF10, RF11, RF12, RNF06 |
| Autor | Juan Diego Edna |
| Revisor | Andrés David López Muñoz |
| Fecha y commit de revisión | pendiente |

## Descripción

El coordinador pide un resumen de hasta 20 solicitudes ENVIADA de su organización. La IA devuelve un borrador marcado como asistencia de IA que solo el coordinador puede aprobar. Si la IA falla, el sistema entrega un resumen determinista y sigue funcionando.

## Entradas

| Campo | Tipo | Validación |
|---|---|---|
| POST /ai/summaries · requestIds | lista de códigos | 1 a 20, sin duplicados, todas ENVIADA y de la organización del coordinador |
| POST /ai/summaries/{id}/approve · id | entero | borrador existente de la misma organización y aún no aprobado |

## Proceso

1. Verificar que el usuario es coordinador; si no, 403.
2. Validar requestIds; si falla, 422 SIN invocar el adaptador (mismo mensaje para un ID ajeno o inexistente).
3. Construir el envío mínimo: requestId, zona, prioridad, fechaRequerida, estado y observaciones.
4. Llamar al adaptador con un límite de 5 segundos.
5. Validar la salida con el esquema del anexo (Ajv, draft 2020-12) y con reglas semánticas: IDs del conjunto enviado, sin duplicados, sin contenido activo.
6. Si la salida es inválida, hay timeout o falla el proveedor: aviso controlado y resumen determinista (prioridad ALTA primero, luego fecha requerida).
7. Guardar el borrador con origen (IA o DETERMINISTA), motivo del fallo y la etiqueta «Asistencia de IA».
8. Al aprobar: APROBADO y un evento APROBAR_RESUMEN. No se reserva, despacha ni cambia prioridad alguna.

## Salidas

| Condición | Resultado |
|---|---|
| resumen | 201 con id, etiqueta, estado BORRADOR, origen, summary (≤ 600), recommendations (≤ 5) y aviso si hubo degradación |
| aprobación | 200 con estado APROBADO |
| validación | 422 en requestIds |
| rol distinto | 403 |

## Reglas

- El texto de la IA es contenido no confiable: se muestra como texto plano y nunca se ejecuta.
- La prioridad viene de la solicitud, no del modelo; la recomendación no es una decisión.
- CI y la demostración no dependen de un servicio de pago (proveedores: none, fixture, ollama).
- Sin reintento automático tras un fallo (supuesto 5).

## Casos límite

- 1 y 20 solicitudes; 21 y lista vacía.
- ID repetido, ajeno o RESERVADA.
- summary de 600 y 601 caracteres; 6 recomendaciones.
- Proveedor que tarda más de 5 s o falla.

## Criterios de aceptación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-RF10-01 | A-001, A-002 y una tercera ENVIADA | el coordinador pide el resumen con un adaptador espía | recibe 201 BORRADOR «Asistencia de IA» con origen IA; el adaptador recibió solo los 6 campos permitidos y ningún nombre, correo, hash ni dato de ORG-B |
| AC-RF10-02 | 21 solicitudes ENVIADA | se piden resúmenes con 20, 21, 0 e IDs repetidos | 20 → 201; los demás → 422 y el adaptador se invocó una sola vez |
| AC-RF10-03 | B-001 de ORG-B | el coordinador de ORG-A lo incluye | 422 con el mismo mensaje que un ID inexistente y el adaptador no se invoca |
| AC-RF10-04 | A-001 RESERVADA | se incluye en el resumen | 422 en requestIds |
| AC-RF10-05 | un resumen de ORG-A | solicitante, bodega y auditor lo piden o aprueban; el coordinador de ORG-B lo aprueba | 403 para los tres roles y 404 para ORG-B |
| AC-RF11-01 | los fixtures del anexo | el coordinador pide un resumen de A-001 y A-002 con cada uno | solo AI-VALID queda con origen IA; JSON-BAD, FOREIGN-ID, EXTRA, ERROR e INJECTION entregan el determinista, sin B-001 y sin cambiar inventario ni solicitudes; el motivo queda registrado |
| AC-RF11-02 | salidas simuladas | la IA devuelve summary de 600 y 601, una propiedad adicional o 6 recomendaciones | 600 es válido; los demás se descartan |
| AC-RF11-03 | una salida con <script> | se valida | se descarta con motivo CONTENIDO_ACTIVO y el texto nunca llega a la interfaz |
| AC-RF12-01 | el fixture AI-TIMEOUT (5.001 ms) | se pide el resumen y mientras tanto se lista | el listado responde durante la espera; a los ≈ 5 s llega 201 DETERMINISTA con motivo TIMEOUT y A-001 (ALTA) primero |
| AC-RF12-02 | un borrador con origen IA | el coordinador lo aprueba | APROBADO, exactamente 1 evento APROBAR_RESUMEN, solicitudes e inventario idénticos; aprobar otra vez → 409 |
| AC-RNF06-01 | sin proveedor configurado | se pide un resumen y se consultan /health y /ready | origen DETERMINISTA con aviso «sin proveedor»; health y ready responden por separado |
