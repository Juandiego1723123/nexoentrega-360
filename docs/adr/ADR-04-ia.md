# ADR-04 · Integración de IA y degradación

- Estado: aceptada · Responsable: David Yepes Cañas
- Contexto: RF10–RF12 piden un asistente que nunca decide, con salida validada, timeout y funcionamiento sin proveedor; RNF06 prohíbe depender de un servicio de pago.

| Alternativa | Ventajas | Desventajas |
|---|---|---|
| Modelo local (Ollama) detrás de un adaptador | Gratis; los datos no salen del equipo | Requiere el modelo descargado para la demo |
| API comercial de IA | Mejor redacción | Costo, datos fuera del sistema; incumple RNF06 |

**Decisión.** Interfaz única `proveedor.generar(solicitudesMinimas)` con tres implementaciones: `none` (por defecto), `fixture` (los 7 fixtures del anexo, para CI) y `ollama` (llama3.2, demostración). Envío mínimo de 6 campos; límite de 5 s; validación con el JSON Schema del anexo (Ajv 2020-12) más reglas semánticas (IDs del conjunto enviado, sin duplicados, sin contenido activo); ante cualquier fallo, resumen determinista y aviso controlado. Se guardan origen y motivo, nunca el texto enviado.

**Consecuencias.** El sistema funciona sin modelo. La salida de IA se muestra como texto plano y solo la aprobación del coordinador genera un evento; aprobar no modifica solicitudes ni inventario.

**Prueba de la decisión.** AC-RF10-01 (adaptador espía), AC-RF11-01 (fixtures del anexo: solo AI-VALID se acepta), AC-RF11-02/03, AC-RF12-01 (AI-TIMEOUT: determinista a los ≈5 s y el sistema sigue respondiendo), AC-RF12-02 y E2E-05.
