Revisión del módulo asistente de IA y despliegue

Archivos revisados:
- apps/api/src/ai/validator.js
- docker-compose.yml
- Pestaña Actions de GitHub

Lo que está bien:
- La salida de la IA se trata como no confiable: se valida con un JSON Schema estricto y se rechazan IDs no enviados, IDs duplicados y contenido activo (script, iframe, javascript: y atributos on...=).
- El tiempo máximo de respuesta de la IA es de 5 segundos, configurable mediante AI_TIMEOUT_MS. Si se supera, se utiliza el resumen determinista.
- En Docker Compose, la aplicación espera a que PostgreSQL esté saludable mediante pg_isready, y la propia aplicación tiene un healthcheck contra /api/ready.
- El último CI está en verde.


Lo que mejoraría:
- docker-compose.yml incluye contraseñas predeterminadas (nexo_demo). En un entorno real deberían configurarse mediante un archivo .env o un mecanismo seguro de gestión de secretos.
- El filtro de contenido activo utiliza una lista de patrones. Como la interfaz muestra texto plano, el riesgo es menor, pero convendría documentar esta decisión en el ADR-04.

Conclusión: 
De acuerdo con entregar el módulo así.

