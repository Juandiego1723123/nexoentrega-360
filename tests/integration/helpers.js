'use strict';
// Infraestructura de pruebas: base PostgreSQL real, seed antes de cada escenario y cliente HTTP con cookie.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://nexo:nexo_demo@localhost:5432/nexoentrega_test';
process.env.LOG_SILENT = 'true';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pool } = require('../../apps/api/src/db');
const { seed } = require('../../apps/api/scripts/seed');
const { crearApp } = require('../../apps/api/src/app');
const { proveedorNinguno } = require('../../apps/api/src/ai/providers');

const PASSWORD = process.env.SEED_PASSWORD || 'NexoDemo2026!';
let migrado = false;

async function migrar() {
  if (migrado) return;
  const { rows } = await pool.query(`SELECT to_regclass('public.requests') AS t`);
  if (!rows[0].t) {
    await pool.query(fs.readFileSync(path.resolve(__dirname, '../../migrations/001_init.sql'), 'utf8'));
    await pool.query(`INSERT INTO schema_migrations (version) VALUES ('001_init.sql') ON CONFLICT DO NOTHING`);
  }
  migrado = true;
}

async function reset() {
  await migrar();
  await seed(pool);
}

// Levanta la app en un puerto libre. `proveedor` se puede cambiar entre pruebas.
async function iniciar() {
  await migrar();
  const estado = { proveedor: proveedorNinguno };
  const server = crearApp({ proveedorIA: () => estado.proveedor }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return {
    base,
    usarProveedor(p) { estado.proveedor = p; },
    async cerrar() { await new Promise((r) => server.close(r)); },
  };
}

function cliente(base) {
  let cookie = null;
  async function pedir(method, ruta, { body, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (body !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(base + ruta, { method, headers: h, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const texto = await res.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { json = texto; }
    return { status: res.status, body: json, headers: res.headers };
  }
  return {
    pedir,
    get: (r, o) => pedir('GET', r, o),
    post: (r, o) => pedir('POST', r, o),
    put: (r, o) => pedir('PUT', r, o),
    del: (r, o) => pedir('DELETE', r, o),
    patch: (r, o) => pedir('PATCH', r, o),
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; },
  };
}

async function sesion(base, email) {
  const c = cliente(base);
  const r = await c.post('/auth/login', { body: { email, password: PASSWORD } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status}`);
  return c;
}

const CUENTAS = {
  solA: 'org-a-solicitante@example.test',
  sol2A: 'org-a-solicitante2@example.test',
  coordA: 'org-a-coordinador@example.test',
  bodA: 'org-a-bodega@example.test',
  audA: 'org-a-auditor@example.test',
  solB: 'org-b-solicitante@example.test',
  coordB: 'org-b-coordinador@example.test',
  bodB: 'org-b-bodega@example.test',
  audB: 'org-b-auditor@example.test',
};

// Oráculos independientes: se consulta la base directamente, no la API.
async function stock(org, sku) {
  const { rows } = await pool.query(
    `SELECT i.on_hand, i.reserved FROM inventory i JOIN products p ON p.id = i.product_id WHERE p.org_id = $1 AND p.sku = $2`, [org, sku]
  );
  return { fisico: rows[0].on_hand, reservado: rows[0].reserved, disponible: rows[0].on_hand - rows[0].reserved };
}
async function estadoDe(code) {
  return (await pool.query('SELECT estado FROM requests WHERE code = $1', [code])).rows[0]?.estado;
}
async function eventos(filtro = {}) {
  const params = [];
  const w = ['true'];
  if (filtro.recursoId) { params.push(filtro.recursoId); w.push(`recurso_id = $${params.length}`); }
  if (filtro.org) { params.push(filtro.org); w.push(`organization_id = $${params.length}`); }
  return (await pool.query(`SELECT * FROM audit_events WHERE ${w.join(' AND ')} ORDER BY id`, params)).rows;
}
const uuid = () => crypto.randomUUID();
const futuro = (dias = 10) => new Date(Date.now() + dias * 86400000).toISOString();
const borrador = (extra = {}) => ({
  zona: 'NORTE', prioridad: 'NORMAL', fechaRequerida: futuro(), observaciones: 'Prueba',
  lineas: [{ sku: 'KIT-AGUA', cantidad: 2 }], ...extra,
});

module.exports = { pool, reset, iniciar, cliente, sesion, CUENTAS, PASSWORD, stock, estadoDe, eventos, uuid, futuro, borrador };
