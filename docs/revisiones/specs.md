# Revisión del módulo SPECS – Andrés David López Muñoz

Archivos revisados: specs/spec-3-inventario/spec.md, docs/clarification-log.md

Lo que está bien:
- SPEC-3 cubre reserva, cancelación, despacho, idempotencia y concurrencia (RF05, RF06, RF07 y RNF02).
- El caso de A-001 (7 KIT-ALIMENTO con físico 10) deja claro el resultado: reservado 7 y disponible 3.
- El registro de aclaraciones tiene 8 preguntas con riesgo, supuesto y responsable.

Lo que mejoré:
- AC-RF07-05 agrupaba tres casos en un solo criterio. Lo dividí en AC-RF07-05 (sin clave: 422), AC-RF07-06 (bodega: 403) y AC-RF07-07 (otra organización: 404).

Lo que falta:
- Las preguntas 1 y 3 del registro siguen enviadas al docente sin respuesta; se entregan con el supuesto vigente.

Conclusión: de acuerdo con entregar el módulo así.
