# ADR-01 · Estructura y límites del sistema

- Estado: aceptada · Responsable: David Yepes Cañas
- Contexto: seis personas, una semana, cuatro roles y dos organizaciones; la reserva y la auditoría deben confirmarse juntas.

| Alternativa | Ventajas | Desventajas |
|---|---|---|
| Monolito modular | Un despliegue; transacciones locales; simple de probar | Requiere disciplina de módulos |
| Microservicios | Escalado independiente | Transacciones distribuidas e infraestructura fuera del plazo |

**Decisión.** Monolito modular: `apps/api` con módulos auth (`middleware/auth.js`), solicitudes e inventario (`services/requests.js`), auditoría (misma transacción) e IA (`ai/`, `services/ai.js`); `apps/web` se compila y se sirve desde la API en el mismo origen.

**Restricciones.** Los módulos solo se comunican por funciones exportadas; la IA nunca escribe en solicitudes ni inventario.

**Consecuencias.** Sin coordinación distribuida. Si crece, el módulo de IA es el primer candidato a separarse (ya está detrás de una interfaz).

**Prueba de la decisión.** `npm run contract:check` (24 operaciones del contrato = rutas) y la prueba E2E-01, que recorre todos los módulos en un solo despliegue.
