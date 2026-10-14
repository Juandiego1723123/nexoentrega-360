# Constitución del equipo VEYRON · NexoEntrega 360

Principios que guían cada decisión del proyecto (Spec Driven Development).

1. **La especificación manda.** Ningún código se escribe sin una SPEC en `specs/` con entradas, proceso, salidas, reglas, casos límite y criterios de aceptación numerados. Si el código y la SPEC difieren, se corrige uno de los dos y se registra en `docs/spec-vs-code.csv`.
2. **Fuente única.** Cada SPEC vive en `spec.md`; `spec.json` se genera con `scripts/export_specs.py` y CI comprueba la coincidencia sin regenerar.
3. **Revisión antes del código.** Otra persona revisa cada SPEC (autor ≠ revisor) y deja fecha y commit antes de fusionar el código afectado.
4. **Los valores del enunciado prevalecen.** Lo ambiguo se pregunta al docente; mientras tanto se registra un supuesto con impacto y responsable (`docs/clarification-log.md`).
5. **El servidor decide.** Permisos, organización y validaciones se comprueban en la API; ocultar un botón no autoriza nada.
6. **La base de datos protege lo crítico.** Restricciones CHECK, claves y triggers repiten las reglas de inventario y auditoría.
7. **La IA propone, el equipo decide.** Toda salida de IA es una propuesta: se registra en `evidence/ai-log/bitacora-ia.md` con la decisión y la verificación humana. Dentro del producto, la salida del modelo es contenido no confiable.
8. **Evidencia verificable.** Una prueba por criterio, contra PostgreSQL real, con oráculos definidos antes; ningún "Cumple" sin resultado comprobado.
9. **Sin secretos ni datos reales.** Solo credenciales ficticias regenerables; nada de servicios de pago para CI o la demostración.
