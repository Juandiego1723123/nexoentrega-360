# SPEC-4 · Consultas y auditoría

| Campo | Valor |
|---|---|
| Versión | v1.0 |
| Historia | HU-04 |
| Como | coordinador o auditor |
| Quiero | consultar las solicitudes de mi organización con filtros y ver su historial de auditoría |
| Para | supervisar la operación sin modificar datos |
| Requisitos | RF08, RF09, RNF01, RNF03 |
| Autor | Juan Diego Edna |
| Revisor | Andrés David López Muñoz |
| Fecha y commit de revisión | pendiente |

## Descripción

Listados paginados y filtrados, tablero con cantidades por estado e historial de auditoría inmutable de cada transición exitosa y cada aprobación de resumen de IA.

## Entradas

| Campo | Tipo | Validación |
|---|---|---|
| GET /requests · page | entero | ≥ 1; por defecto 1 |
| GET /requests · pageSize | entero | 1 a 100; por defecto 20 |
| GET /requests · estado | enum | BORRADOR, ENVIADA, RESERVADA, DESPACHADA, ENTREGADA o CANCELADA |
| GET /requests · prioridad | enum | NORMAL o ALTA |
| GET /requests · zona | enum | lista de zonas; desconocida → 422 |
| GET /audit · page, pageSize | entero | mismas reglas |
| GET /audit · desde, hasta | fecha ISO 8601 UTC | desde ≤ hasta |

## Proceso

1. Autenticar; rol y organización salen de la sesión.
2. Validar parámetros; si alguno es inválido, 422 con el campo.
3. Filtrar por la organización; si es solicitante, además por su identificador.
4. Aplicar filtros, ordenar por fecha de creación descendente y paginar.
5. El tablero cuenta las solicitudes por estado (0 si no hay).
6. Cada transición exitosa y cada aprobación de resumen escribe un evento en la misma transacción.

## Salidas

| Condición | Resultado |
|---|---|
| listado | items, page, pageSize y total |
| tablero | conteo por cada uno de los 6 estados |
| evento | id, actorId, organizacionId, recurso, recursoId, accion, fechaUtc y correlationId |
| PUT, PATCH o DELETE /audit/{id} | 405 |

## Reglas

- El historial no se edita ni se borra: no hay operaciones de escritura y un trigger rechaza UPDATE y DELETE en la base.
- Una operación rechazada puede dejar un log técnico, pero nunca un evento de transición.
- Si falla la escritura del evento, se revierte toda la transacción.
- Solo el auditor consulta /audit; el solicitante no consulta inventario.

## Casos límite

- pageSize 0, 100 y 101.
- Página mayor al total (lista vacía con total).
- Filtros sin resultados.
- Zona desconocida (422).
- desde > hasta (422).

## Criterios de aceptación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-RF08-01 | 150 solicitudes de ORG-A y 30 de ORG-B | el coordinador de ORG-A pide pageSize 100 | recibe 200, 100 elementos y total 150, todos de ORG-A; la página 2 trae 50 y la 9 viene vacía |
| AC-RF08-02 | el coordinador de ORG-A | pide pageSize 101, 0 o texto, o filtra por zona o estado desconocidos | recibe 422 asociado al campo; pageSize 100 es válido |
| AC-RF08-03 | el solicitante 2 creó un borrador | el solicitante 1 lista, abre ese borrador y consulta el tablero | solo ve A-001 y A-002, recibe 403 en el detalle ajeno y su tablero no cuenta el borrador; inventario → 403 |
| AC-RF08-04 | el seed | el coordinador filtra y pide B-001; la bodega lista e inventaría | filtros por prioridad, zona y estado devuelven lo esperado; B-001 → 404; la bodega ve su organización |
| AC-RF08-05 | 25 solicitudes extra y una reserva en ORG-A | el coordinador consulta /dashboard | los conteos coinciden con una consulta directa a la base |
| AC-RF09-01 | una petición con X-Correlation-Id conocido | el coordinador reserva A-001 | existe exactamente 1 evento con actor, organización, recurso, acción RESERVAR, fecha UTC y ese correlationId |
| AC-RF09-02 | A-001 ENVIADA | la bodega intenta despacharla | recibe 409 y el número de eventos no cambia |
| AC-RF09-03 | un evento de auditoría | el auditor hace PUT, PATCH o DELETE y se intenta UPDATE/DELETE directo en la base | la API responde 405, la base lo rechaza y el evento queda igual; el coordinador recibe 403 en /audit |
| AC-RF09-04 | un trigger de prueba que hace fallar la inserción del evento | el coordinador reserva A-001 | recibe 500 sin detalles internos; estado, inventario e idempotencia quedan como antes |
| AC-RF09-05 | un evento de hoy | el auditor filtra por rango | el rango que lo contiene devuelve 1, uno futuro 0 y desde > hasta → 422 en desde |
| AC-RNF03-01 | 2.000 solicitudes sembradas | 20 usuarios virtuales consultan listados y tablero 60 s después de 5 s de calentamiento | p95 ≤ 700 ms y errores < 1 %, medido con k6 |
