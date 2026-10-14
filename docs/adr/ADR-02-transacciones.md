# ADR-02 · Estrategia transaccional e idempotencia

- Estado: aceptada · Responsable: Jhonatan David Yepes Luna
- Contexto: RF05–RF07 exigen reserva total o nula, sin negativos y sin efectos duplicados ante peticiones simultáneas o repetidas.

| Alternativa | Ventajas | Desventajas |
|---|---|---|
| Bloqueo pesimista (SELECT … FOR UPDATE) | Predecible; evita sobreventa | Serializa reservas del mismo producto |
| Bloqueo optimista (columna version) | Sin bloqueos largos | Reintentos y complica la idempotencia |
| Aislamiento SERIALIZABLE | Garantía fuerte | Fallos de serialización que reintentar |

**Decisión.** En una transacción: (1) `INSERT … ON CONFLICT DO NOTHING` de la clave (clave, usuario, operación, hash del contenido); una segunda petición con la misma clave espera el commit y repite la respuesta guardada; (2) `FOR UPDATE` de la solicitud; (3) `FOR UPDATE` de las filas de inventario en orden de producto; (4) verificación de todas las líneas; (5) reserva, estado, evento y respuesta de idempotencia en el mismo commit. CHECK en la base como última barrera.

**Consecuencias.** Las reservas sobre el mismo SKU se procesan una a la vez (aceptable para el volumen). 200 y 409 de negocio se guardan 24 h; 401/403/404/422/5xx no.

**Prueba de la decisión.** AC-RF07-03 (5 rondas de reservas simultáneas contra PostgreSQL real: siempre una 200 y una 409, reservado 7), AC-RF07-03b (misma clave en simultáneo, un solo efecto), AC-RF07-01/02/05 y AC-RNF02-01.
