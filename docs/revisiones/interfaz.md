Revisión del módulo interfaz – Juan Fernando Jiménez Benjumea
Archivos revisados:
- apps/web/src/Login.jsx
- evidence/screenshots/
Lo que está bien:
- Cada campo del inicio de sesión tiene su etiqueta asociada. Los errores de campo utilizan aria-invalid y aria-describedby, y el error general utiliza role="alert".
- El botón se deshabilita mientras se envía el formulario y muestra «Ingresando…», evitando envíos duplicados.
- Hay 20 capturas: las mismas 10 pantallas en celular (390 px) y computador (1366 px), incluidos el error de campo y el aislamiento de ORG-B.
Lo que mejoraría:
- Los errores de campo no se anuncian automáticamente a los lectores de pantalla. Se podría agregar aria-live o mover el foco al primer campo con error.
- El texto de ayuda con las cuentas de demostración debería ocultarse fuera del entorno de pruebas.
Conclusión: De acuerdo con entregar el módulo así.
