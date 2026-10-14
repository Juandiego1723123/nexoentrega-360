'use strict';
// Carga el escenario base del anexo (seeds/seed-data.json). Reinicia TODOS los datos: úselo solo en demo y pruebas.
// Uso: node apps/api/scripts/seed.js [--if-empty]
const path = require('node:path');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { pool } = require('../src/db');

const data = require(path.resolve(__dirname, '../../../seeds/seed-data.json'));

async function seed(client = pool) {
  const hash = await bcrypt.hash(config.seedPassword, 10);
  await client.query(`TRUNCATE ai_summaries, audit_events, idempotency_keys, request_lines, requests,
                      inventory, products, sessions, users, organizations RESTART IDENTITY CASCADE`);
  for (const o of data.organizations) {
    const n = data.requests.filter((r) => r.organizationId === o.id).length + 1;
    await client.query('INSERT INTO organizations (id, name, code_prefix, next_request_number) VALUES ($1, $2, $3, $4)', [o.id, o.name, o.codePrefix, n]);
  }
  const usuarios = {};
  for (const a of data.accounts) {
    const r = await client.query('INSERT INTO users (org_id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [a.organizationId, a.email, a.name, a.role, hash]);
    usuarios[a.email] = r.rows[0].id;
  }
  const productos = {};
  for (const p of data.products) {
    const r = await client.query('INSERT INTO products (org_id, sku, name, active) VALUES ($1, $2, $3, $4) RETURNING id', [p.organizationId, p.sku, p.name, p.active]);
    productos[`${p.organizationId}/${p.sku}`] = r.rows[0].id;
    await client.query('INSERT INTO inventory (product_id, on_hand, reserved) VALUES ($1, $2, $3)', [r.rows[0].id, p.onHand, p.reserved]);
  }
  for (const s of data.requests) {
    await client.query(
      `INSERT INTO requests (code, org_id, requester_id, zona, prioridad, fecha_requerida, observaciones, estado, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = 'BORRADOR' THEN NULL ELSE now() END)`,
      [s.code, s.organizationId, usuarios[s.ownerEmail], s.zona, s.prioridad, s.fechaRequerida, s.observaciones, s.estado]
    );
    for (const l of s.lines) {
      await client.query('INSERT INTO request_lines (request_code, product_id, cantidad) VALUES ($1, $2, $3)',
        [s.code, productos[`${s.organizationId}/${l.sku}`], l.cantidad]);
    }
  }
}

async function main() {
  if (process.argv.includes('--if-empty')) {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM organizations');
    if (rows[0].n > 0) { console.log('seed omitido: la base ya tiene datos'); return pool.end(); }
  }
  await seed();
  console.log(`seed cargado: ${data.accounts.length} cuentas, ${data.products.length} productos, ${data.requests.length} solicitudes`);
  await pool.end();
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { seed };
