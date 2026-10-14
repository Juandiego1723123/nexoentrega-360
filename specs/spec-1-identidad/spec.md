# SPEC-1 · Identidad y permisos

| Campo | Valor |
|---|---|
| Versión | v1.0 |
| Historia | HU-01 |
| Como | usuario de una organización (solicitante, coordinador, bodega o auditor) |
| Quiero | iniciar sesión con mi cuenta |
| Para | acceder solo a las operaciones de mi rol y a los datos de mi organización |
| Requisitos | RF01, RF02, RNF01 |
| Autor | Juan Diego Edna |
| Revisor | Andrés David López Muñoz |
| Fecha y commit de revisión | pendiente |

## Descripción

Inicio y cierre de sesión con cuentas sembradas y control de acceso por rol y por organización en todas las operaciones de la API.

## Entradas

| Campo | Tipo | Validación |
|---|---|---|
| POST /auth/login · email | texto | formato de correo; máximo 120 caracteres |
| POST /auth/login · password | texto | 8 a 72 caracteres |
| POST /auth/logout | — | requiere sesión activa |
| GET /auth/me | — | requiere sesión activa |

## Proceso

1. Buscar el usuario por correo y comparar la contraseña con su hash bcrypt.
2. Si coincide, crear una sesión en el servidor (se guarda solo el SHA-256 del token) y entregar la cookie nexo_sid HttpOnly y SameSite=Lax.
3. En cada petición protegida: sin sesión válida → 401; rol sin permiso sobre un recurso de su organización → 403; recurso inexistente o de otra organización → 404.
4. El rol y la organización se toman siempre de la sesión, nunca del cuerpo ni de los parámetros.
5. Al cerrar sesión se elimina la sesión del servidor; la cookie anterior deja de servir.

## Salidas

| Condición | Resultado |
|---|---|
| login correcto | 200 con id, nombre, rol y organizacion; cookie de sesión |
| credenciales incorrectas o correo inexistente | 401 con el mismo mensaje genérico; no se crea sesión |
| logout | 204; la sesión se borra |
| datos inválidos | 422 con el campo |

## Reglas

- Contraseñas con bcrypt (costo 10); ningún secreto real en el repositorio (se usa .env.example).
- No existe selector de rol que reemplace el inicio de sesión.
- El seed crea una cuenta por rol en cada organización (8) y una segunda cuenta de solicitante en ORG-A; la contraseña sale de SEED_PASSWORD.
- Respuestas, errores y logs nunca incluyen datos de otra organización ni contraseñas.

## Casos límite

- Contraseña incorrecta y correo inexistente producen el mismo 401.
- Sesión expirada o cookie alterada → 401.
- Identificador de otra organización conocido por el usuario → 404.

## Criterios de aceptación

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| AC-RF01-01 | el coordinador de ORG-A con credenciales válidas | inicia sesión y consulta GET /auth/me | recibe 200 y una cookie HttpOnly SameSite=Lax; /auth/me devuelve rol COORDINADOR y organización ORG-A |
| AC-RF01-02 | una contraseña incorrecta o un correo inexistente | se intenta iniciar sesión | ambos reciben 401 con el mismo mensaje y no se crea ninguna sesión |
| AC-RF01-03 | un usuario que cerró sesión | usa la cookie anterior | recibe 401 |
| AC-RF01-04 | la base sembrada | se consulta users.password_hash y sessions | los hashes son bcrypt, no contienen la contraseña y la sesión guarda solo un SHA-256 |
| AC-RF02-01 | el coordinador de ORG-A | pide GET /requests/B-001 | recibe 404 sin datos de ORG-B |
| AC-RF02-02 | una reserva hecha en ORG-B | el auditor de ORG-A consulta /audit | no aparece ningún evento de ORG-B |
| AC-RF02-03 | el coordinador de ORG-A | intenta reservar B-001 | recibe 404; el inventario de ORG-B y la tabla de idempotencia no cambian |
| AC-RF02-04 | B-001 RESERVADA | la bodega de ORG-A intenta despacharla | recibe 404 y nada cambia |
| AC-RF02-05 | A-001 ENVIADA | la bodega de ORG-A intenta reservarla | recibe 403 y el estado no cambia |
| AC-RNF01-01 | un cliente sin sesión | llama cualquier endpoint protegido (18 rutas) | recibe 401; /health sigue respondiendo 200 |
