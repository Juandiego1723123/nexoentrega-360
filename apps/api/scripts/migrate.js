'use strict';
// Aplica en orden las migraciones de migrations/ que aún no estén registradas.
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/db');

async function main() {
  const dir = path.resolve(__dirname, '../../../migrations');
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const hechas = new Set((await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (hechas.has(archivo)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, archivo), 'utf8'));
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      console.log(`migración aplicada: ${archivo}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
