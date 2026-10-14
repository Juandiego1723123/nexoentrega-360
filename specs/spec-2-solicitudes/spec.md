# SPEC-2 · Solicitudes

| Campo | Valor |
|---|---|
| Versión | v1.0 |
| Historia | HU-02 |
| Como | solicitante |
| Quiero | crear, editar y enviar solicitudes de kits válidas |
| Para | que el coordinador pueda evaluarlas |
| Requisitos | RF03, RF04 |
| Autor | Juan Diego Edna |
| Revisor | Andrés David López Muñoz |
| Fecha y commit de revisión | pendiente |

## Descripción

Creación, edición y envío de solicitudes de kits y control del ciclo de estados de la solicitud.

## Entradas

| Campo | Tipo | Validación |
|---|---|---|
| zona | enum | NORTE, SUR, CENTRO, ORIENTE u OCCIDENTE (supuesto 1) |
| prioridad | enum | NORMAL o ALTA |
| fechaRequerida | fecha ISO 8601 | al enviar, no anterior al momento del envío |
| observaciones | texto opcional | máximo 500 caracteres (supuesto 3) |
| lineas | lista | 1 a 10 líneas; sin SKU repetidos |
| lineas[].sku | texto | SKU activo de la organización del usuario |
| lineas[].cantidad | entero | 1 a 500; sin negativos ni decimales |

## Proceso

1. Crear (POST /requests): validar, generar un código único por organización (A-003…), tomar solicitante y organización de la sesión y guardar en BORRADOR.
2. Editar (PUT /requests/{id}): solo el solicitante dueño y solo en BORRADOR; en otro estado 409 sin cambios.
3. Enviar (POST /requests/{id}/submit): opcionalmente recibe el contenido final; revalida todo (incluida la fecha contra el momento del envío), pasa a ENVIADA y registra el evento ENVIAR. No reserva inventario.
4. Cancelar (POST /requests/{id}/cancel): solo el solicitante dueño, desde ENVIADA o RESERVADA; si estaba RESERVADA libera la reserva (SPEC-3).
5. Entregar (POST /requests/{id}/deliver): solo el coordinador, de DESPACHADA a ENTREGADA; no altera inventario.
6. Cualquier transición no definida responde 409 y conserva datos e inventario.

## Salidas

| Condición | Resultado |
|---|---|
| crear | 201 con la solicitud en BORRADOR |
| editar o transición válida | 200 con la solicitud |
| validación | 422 con el campo exacto (por ejemplo lineas[0].cantidad) |
| transición inválida | 409 sin cambios |

## Reglas

- Solo el borrador es editable.
- Enviar no reserva stock.
- Un solicitante no opera solicitudes de otro solicitante (403, supuesto 8).
- Cada transición exitosa escribe un evento de auditoría en la misma transacción.

## Casos límite

- Cantidades 0, 1, 500, 501, 2.5 y −1.
- 0, 1, 10 y 11 líneas.
- SKU repetido o inactivo.
- Fecha igual o anterior al momento del envío.
- Observaciones de 500 y 501 caracteres.

## Criterios de aceptación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-RF03-01 | un borrador propio de ORG-A con SKU activo | el solicitante lo envía con cantidad 0 | recibe 422 en lineas[0].cantidad; el borrador conserva estado y líneas; inventario y auditoría no cambian |
| AC-RF03-02 | un solicitante de ORG-A | crea borradores con cantidades 1, 500, 501, −1, 2.5 y 0 | 1 y 500 responden 201; las demás 422 en la cantidad |
| AC-RF03-03 | un solicitante de ORG-A | envía un SKU repetido, 0 líneas, 11 líneas o un SKU inactivo | recibe 422 en el campo correspondiente; 10 líneas no violan la regla de cantidad de líneas |
| AC-RF03-04 | un borrador con fecha requerida anterior a ahora | se intenta enviar | recibe 422 en fechaRequerida y sigue en BORRADOR; observaciones de 501 caracteres → 422 y de 500 → 201 |
| AC-RF03-05 | el seed (A-001 y A-002 existen) | el solicitante crea dos borradores válidos | recibe 201, estado BORRADOR y códigos A-003 y A-004; un coordinador recibe 403; ORG-B numera B-002 |
| AC-RF04-01 | A-001 ENVIADA | el dueño intenta editarla | recibe 409 y las líneas no cambian; un borrador sí se edita (200) |
| AC-RF04-02 | A-001 ENVIADA | el coordinador registra la entrega | recibe 409 y el estado no cambia |
| AC-RF04-03 | A-001 del solicitante 1 | el solicitante 2 de ORG-A intenta cancelarla o verla | recibe 403 y nada cambia |
| AC-RF04-04 | un borrador nuevo de 4 KIT-AGUA | se recorre BORRADOR → ENVIADA → RESERVADA → DESPACHADA → ENTREGADA | existen exactamente 4 eventos (ENVIAR, RESERVAR, DESPACHAR, ENTREGAR), el físico queda en 16 y ENTREGADA no se puede cancelar |
