# Registro de aclaraciones y supuestos

Los valores explícitos del enunciado prevalecen. Las preguntas que requieren decisión del cliente se envían al docente; mientras no haya respuesta, rige el supuesto.

| # | Pregunta | Requisito | Riesgo si no se resuelve | Respuesta o supuesto | Estado | Responsable |
|---|---|---|---|---|---|---|
| 1 | ¿Qué zonas son válidas y cómo se trata una desconocida? | RF03, RF08 | Rechazar zonas legítimas o aceptar basura | NORTE, SUR, CENTRO, ORIENTE, OCCIDENTE (incluye las del anexo); desconocida → 422 | Supuesto; enviada al docente | Andrés |
| 2 | ¿Formato de fecha y zona horaria? | RF03, RF09 | Errores de un día en fechas límite | Se guarda en UTC (RF09 exige fecha UTC en auditoría) y se muestra en hora de Colombia | Resuelto por el enunciado | Juan Diego Edna |
| 3 | ¿Límite de las observaciones? | RF03 | Textos enormes o truncados | Máximo 500 caracteres, texto plano | Supuesto; enviada al docente | Andrés |
| 4 | ¿Se guardan los intentos fallidos de IA? | RF12 | Perder trazabilidad de fallos | Se guarda origen y motivo del fallo, nunca el texto enviado al modelo | Supuesto | David |
| 5 | ¿Reintento automático si falla la IA? | RF12 | Esperas largas o costos | Sin reintento; el coordinador puede volver a pedir el resumen | Supuesto | David |
| 6 | ¿Qué responde la API ante un recurso de otra organización? | RF02 | Revelar existencia | 404 | Resuelto por el enunciado | Jhonatan |
| 7 | ¿Qué respuestas guarda la idempotencia? | RF07 | Reintentos que no se repiten o duplicados | 200 y 409 de negocio por 24 h; 401, 403, 404, 422 y 5xx no se guardan (RF07 deja la decisión al contrato) | Resuelto por el enunciado (decisión documentada en el contrato) | Jhonatan |
| 8 | ¿Un solicitante puede ver la solicitud de otro de su organización? | RF02, RF08 | Fuga entre solicitantes | No: 403 | Supuesto | Andrés |
