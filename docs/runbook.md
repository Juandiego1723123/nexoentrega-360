# Runbook · NexoEntrega 360

Objetivo (RNF04): iniciar desde un clon limpio en 15 minutos o menos, sin contar la descarga inicial de imágenes y paquetes (ese tiempo se reporta aparte).

## 1. Configuración

```bash
git clone https://github.com/Juandiego1723123/nexoentrega-360.git
cd nexoentrega-360
cp .env.example .env        # valores de demostración; no hay secretos reales
```

Variables relevantes: `DATABASE_URL`, `SEED_PASSWORD` (contraseña común de las cuentas ficticias), `AI_PROVIDER` (`none` | `fixture` | `ollama`), `AI_FIXTURE`, `OLLAMA_URL`, `OLLAMA_MODEL`, `COOKIE_SECURE`.

## 2. Arranque con Docker (un comando)

```bash
docker compose up -d --build     # crea la base, migra, siembra si está vacía y levanta la app
curl localhost:3000/api/ready    # {"status":"ready"}
```

Abrir http://localhost:3000.

## 3. Arranque sin Docker (requiere PostgreSQL 16 y Node.js 22)

```bash
npm ci && npm run build && npm run migrate && npm run seed && npm start
```

## 4. Comprobaciones

```bash
npm run check        # specs ↔ JSON, contrato ↔ rutas, criterios ↔ pruebas
npm test             # 60 pruebas unitarias y de integración (TEST_DATABASE_URL)
npm run test:e2e     # 10 pruebas E2E en 1366 y 390 px (la app debe poder iniciar)
make carga           # k6: 2.000 solicitudes, 20 VU, 60 s tras 5 s
```

## 5. Datos

- Migraciones: `migrations/*.sql`, aplicadas en orden por `npm run migrate` (tabla `schema_migrations`).
- Seed: `npm run seed` reinicia todos los datos con el escenario del anexo (`seeds/seed-data.json`). Para regenerar las credenciales, cambie `SEED_PASSWORD` y vuelva a ejecutar el seed.
- Carga: `npm run seed:load` completa 2.000 solicitudes en ORG-A sin tocar inventario.

## 6. Recuperación

- Estado limpio: `docker compose down -v && docker compose up -d --build`.
- Solo datos: `docker compose exec app node apps/api/scripts/seed.js`.

## 7. Recuperación ante fallo de IA

Si el modelo no responde en 5 s o su salida no pasa la validación, el sistema entrega el resumen determinista sin intervención (AC-RF12-01). Para operar sin modelo de forma explícita: `AI_PROVIDER=none` en `.env` y `docker compose up -d app`. La base de datos no se toca. Para la demostración con Ollama: `ollama pull llama3.2` antes de iniciar y `AI_PROVIDER=ollama`.

## 8. Reversión de aplicación (rollback)

Se revierte la aplicación, no los datos; no se promete revertir datos sin respaldo.

1. Antes de desplegar una versión nueva, respaldar: `docker compose exec -T db pg_dump -U nexo nexoentrega > backup.sql`.
2. Volver a la versión previa: `git checkout baseline-v1 && docker compose up -d --build`.
3. Compatibilidad del esquema: `git diff --stat baseline-v1 release-examen -- migrations/`. Entre `baseline-v1` y `release-examen` no hay migraciones nuevas (solo `001_init.sql`), así que la versión previa funciona sobre el mismo esquema. Si en el futuro se agrega una migración no compatible, restaurar el respaldo: `docker compose down -v && docker compose up -d db && docker compose exec -T db psql -U nexo nexoentrega < backup.sql && docker compose up -d app`.
4. Comprobar `curl localhost:3000/api/ready` y el recorrido del acta de aceptación.

## 9. Problemas conocidos

- Arranque con Docker medido el 14-oct-2026 en Windows con Docker Desktop: 62 s desde `docker compose up -d --build` hasta `/api/ready` = 200 (build de la imagen 11 s; imágenes base ya descargadas: 2 s).
- Las pruebas E2E reinician la base de la aplicación (seed) antes de cada caso: no las ejecute contra datos que quiera conservar.
