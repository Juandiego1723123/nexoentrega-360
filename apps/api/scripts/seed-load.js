'use strict';
// RNF03: agrega solicitudes a ORG-A hasta llegar a 2.000 para la prueba de carga (no altera inventario).
const { pool } = require('../src/db');

const ESTADOS = ['BORRADOR', 'ENVIADA', 'RESERVADA', 'DESPACHADA', 'ENTREGADA', 'CANCELADA'];
const ZONAS = ['NORTE', 'SUR', 'CENTRO', 'ORIENTE', 'OCCIDENTE'];

async function main() {
  const objetivo = Number(process.argv[2]) || 2000;
  const actual = (await pool.query("SELECT count(*)::int AS n FROM requests")).rows[0].n;
  const faltan = Math.max(0, objetivo - actual);
  const users = (await pool.query("SELECT id FROM users WHERE org_id = 'ORG-A' AND role = 'SOLICITANTE' ORDER BY id")).rows.map((r) => r.id);
  const prod = (await pool.query("SELECT p.id FROM products p WHERE p.org_id = 'ORG-A' AND p.sku = 'KIT-AGUA'")).rows[0].id;
  const inicio = (await pool.query("UPDATE organizations SET next_request_number = next_request_number + $1 WHERE id = 'ORG-A' RETURNING next_request_number - $1 AS n", [faltan])).rows[0].n;
  for (let i = 0; i < faltan; i++) {
    const code = `A-${String(inicio + i).padStart(4, '0')}`;
    await pool.query(
      `INSERT INTO requests (code, org_id, requester_id, zona, prioridad, fecha_requerida, observaciones, estado, created_at)
       VALUES ($1, 'ORG-A', $2, $3, $4, now() + interval '30 days', 'Carga RNF03', $5, now() - ($6 || ' minutes')::interval)`,
      [code, users[i % users.length], ZONAS[i % ZONAS.length], i % 3 === 0 ? 'ALTA' : 'NORMAL', ESTADOS[i % ESTADOS.length], String(i)]
    );
    await pool.query('INSERT INTO request_lines (request_code, product_id, cantidad) VALUES ($1, $2, $3)', [code, prod, 1 + (i % 5)]);
  }
  console.log(`solicitudes totales: ${actual + faltan}`);
  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
