# SPEC-3 · Inventario y transiciones

| Campo | Valor |
|---|---|
| Versión | v1.0 |
| Historia | HU-03 |
| Como | coordinador o bodega |
| Quiero | reservar, despachar y cancelar solicitudes con un inventario consistente |
| Para | no prometer el mismo kit a dos solicitantes |
| Requisitos | RF05, RF06, RF07, RNF02 |
| Autor | Juan Diego Edna |
| Revisor | Andrés David López Muñoz |
| Fecha y commit de revisión | pendiente |

## Descripción

Reserva atómica e idempotente de existencias, despacho y cancelación con inventario siempre consistente, incluso con peticiones simultáneas.

## Entradas

| Campo | Tipo | Validación |
|---|---|---|
| POST /requests/{id}/reserve · Idempotency-Key | encabezado UUID | obligatorio; se procesa después de autenticar y autorizar |
| POST /requests/{id}/dispatch | — | la solicitud debe estar RESERVADA |
| GET /inventory · page, pageSize | entero | mismas reglas de paginación de SPEC-4 |

## Proceso

1. Cargar la solicitud de la organización del usuario (404 si no existe o es ajena) y verificar rol coordinador (403).
2. Validar Idempotency-Key (422 si falta o no es UUID).
3. En una transacción, insertar la clave (clave, usuario, operación, hash del contenido) con ON CONFLICT DO NOTHING. Si ya existía: mismo hash → repetir la respuesta guardada; hash distinto → 409.
4. Bloquear la solicitud (SELECT … FOR UPDATE); si no está ENVIADA, guardar y devolver 409.
5. Bloquear las filas de inventario de sus SKU en orden de producto y comprobar que disponible = físico − reservado alcanza para TODAS las líneas; si no, guardar y devolver 409 sin modificar nada.
6. Sumar las reservas, pasar a RESERVADA, registrar el evento y guardar el resultado 200 de idempotencia; confirmar.

## Salidas

| Condición | Resultado |
|---|---|
| reserva exitosa | 200 con la solicitud y el inventario resultante |
| repetición con la misma clave y contenido | la misma respuesta y encabezado Idempotent-Replayed |
| misma clave con otro contenido | 409 IDEMPOTENCIA_CONFLICTO |
| stock insuficiente o estado inválido | 409 sin cambios |

## Reglas

- Despachar (bodega, desde RESERVADA): resta la cantidad del físico y de la reserva.
- Cancelar una RESERVADA resta exactamente su reserva; el físico no cambia.
- Cancelar una ENVIADA o registrar ENTREGADA no altera inventario.
- La base impone on_hand ≥ 0, reserved ≥ 0 y reserved ≤ on_hand (CHECK).
- Un error antes del commit no deja reserva parcial.
- La idempotencia guarda 200 y 409 de negocio al menos 24 h; 401, 403, 404, 422 y 5xx no se guardan (supuesto 7).
- Una clave no recupera la respuesta de otro usuario (la clave primaria incluye el usuario).

## Casos límite

- Dos reservas simultáneas que compiten por existencias insuficientes.
- La misma clave enviada dos veces en simultáneo.
- Una línea suficiente y otra insuficiente.

## Criterios de aceptación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-RF05-01 | A-001 ENVIADA con 7 KIT-ALIMENTO y físico 10, reservado 0 | el coordinador la reserva | recibe 200; físico 10, reservado 7, disponible 3; RESERVADA y 1 evento (oráculo del anexo) |
| AC-RF05-02 | una solicitud ENVIADA con 2 KIT-ALIMENTO y 9 KIT-HIGIENE (físico 8) | el coordinador la reserva | recibe 409 STOCK_INSUFICIENTE; ninguna línea ni el estado cambian |
| AC-RF05-03 | una solicitud en BORRADOR | el coordinador intenta reservarla | recibe 409 y el inventario no cambia |
| AC-RF06-01 | A-001 RESERVADA | el dueño la cancela | físico 10, reservado 0, disponible 10; cancelar A-002 ENVIADA no altera inventario |
| AC-RF06-02 | A-001 RESERVADA | la bodega la despacha | físico 3, reservado 0, disponible 3; despachar una ENVIADA → 409 |
| AC-RF06-03 | A-001 DESPACHADA | el coordinador registra la entrega | ninguna cantidad de inventario cambia |
| AC-RF07-01 | una reserva exitosa con la clave K | se repite con K y el mismo contenido | la respuesta es idéntica, marcada Idempotent-Replayed; una sola reserva y un solo evento |
| AC-RF07-02 | la clave K usada en A-001 | se usa K para A-002 o con otro cuerpo | recibe 409 IDEMPOTENCIA_CONFLICTO y A-002 sigue ENVIADA |
| AC-RF07-03 | A-001 y A-002 piden 7 cada una con disponible 10 | se reservan en simultáneo (5 rondas, seed limpio) | exactamente una 200 y una 409; físico 10, reservado 7, disponible 3; un solo evento |
| AC-RF07-03b | la misma clave K | se envía dos veces en simultáneo para A-001 | ambas responden 200 con un solo efecto y un solo evento |
| AC-RF07-04 | A-001 ya RESERVADA | se reserva otra vez con otra clave | recibe 409 TRANSICION_INVALIDA porque ya no está ENVIADA |
| AC-RF07-05 | el contrato de idempotencia | se reserva sin clave, con rol bodega (403) y sobre B-001 (404) | sin clave → 422; 403 y 404 no se guardan; la misma clave de otro usuario es una operación independiente; el TTL es de al menos 24 h |
| AC-RNF02-01 | la base real | se intenta dejar existencias o reservas negativas o reservado > físico | las restricciones CHECK lo rechazan y ningún mínimo queda negativo |
