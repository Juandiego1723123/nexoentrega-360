Título del PR: Revisión del módulo backend y datos – Jhonatan David Yepes Luna

Archivos revisados:
- migrations/001_init.sql
- contracts/openapi.yaml

Lo que está bien:
- Las restricciones ck_inventory_on_hand, ck_inventory_reserved y ck_inventory_disponible evitan estados inválidos del inventario, incluido que las unidades reservadas superen las físicas.
- La auditoría es de solo inserción gracias al trigger tr_audit_events_inmutable.
- Las cantidades por línea tienen una restricción CHECK entre 1 y 500, y existen índices por organización y estado para los listados.
- El contrato documenta las rutas de solicitudes (/requests, submit, reserve, dispatch, deliver y cancel), y el CI verifica que coincidan con Express.

Lo que mejoraría:
- Las claves de idempotencia vencidas solo se eliminan cuando se reutiliza la misma clave. Conviene implementar una limpieza periódica para evitar que la tabla crezca indefinidamente.
- El contrato no incluye operationId en las operaciones. Agregarlos facilitaría la generación de clientes.
Conclusión: De acuerdo con entregar el módulo así.
