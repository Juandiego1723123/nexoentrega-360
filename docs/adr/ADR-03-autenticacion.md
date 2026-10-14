# ADR-03 · Autenticación y aislamiento por organización

- Estado: aceptada · Responsable: Jhonatan David Yepes Luna
- Contexto: RF01 permite sesiones o tokens y pide justificar; RF02 exige aislamiento total entre organizaciones.

| Alternativa | Ventajas | Desventajas |
|---|---|---|
| Sesión en servidor con cookie HttpOnly | Cierre de sesión real; el token no es accesible a JavaScript | Hay que almacenar sesiones |
| JWT en el cliente | Sin estado en el servidor | Revocar al cerrar sesión es difícil; riesgo si se guarda en localStorage |

**Decisión.** Sesión en servidor (`sessions`, solo el SHA-256 del token) con cookie `nexo_sid` HttpOnly y SameSite=Lax (Secure detrás de HTTPS). El middleware toma rol y organización de la sesión; toda consulta filtra por `org_id`; un recurso ajeno o inexistente responde 404 y una acción prohibida sobre un recurso propio responde 403.

**Consecuencias.** El cierre de sesión invalida el acceso de inmediato. Contraseñas con bcrypt; login con mensaje y tiempo similares para correo inexistente.

**Prueba de la decisión.** AC-RF01-01 a 04 y AC-RF02-01 a 05 (dos lecturas y dos escrituras cruzadas denegadas sin cambios), AC-RNF01-01 (18 rutas sin sesión → 401) y E2E-04.
