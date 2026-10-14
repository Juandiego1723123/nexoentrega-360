'use strict';
// SPEC-4 · Consultas y auditoría (RF08, RF09, RNF01)
const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let app;
before(async () => { app = await H.iniciar(); });
beforeEach(() => H.reset());
after(async () => { await app.cerrar(); });

async function sembrarSolicitudes(org, n, requesterEmail) {
  const u = (await H.pool.query('SELECT id FROM users WHERE email = $1', [requesterEmail])).rows[0].id;
  await H.pool.query(
    `INSERT INTO requests (code, org_id, requester_id, zona, prioridad, fecha_requerida, estado)
     SELECT $1 || '-' || lpad((100 + g)::text, 4, '0'), $2, $3, 'CENTRO', CASE WHEN g % 2 = 0 THEN 'ALTA' ELSE 'NORMAL' END,
            now() + interval '5 days', 'ENVIADA'
       FROM generate_series(1, $4) g`, [org === 'ORG-A' ? 'A' : 'B', org, u, n]
  );
}

describe('SPEC-4 · Consultas y auditoría', () => {
  test('AC-RF08-01 con 150 solicitudes de ORG-A, pageSize 100: 200, 100 elementos, total 150, todos de ORG-A', async () => {
    await sembrarSolicitudes('ORG-A', 148, H.CUENTAS.solA);
    await sembrarSolicitudes('ORG-B', 30, H.CUENTAS.solB);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await coord.get('/requests?pageSize=100');
    assert.equal(r.status, 200);
    assert.equal(r.body.items.length, 100);
    assert.equal(r.body.total, 150);
    assert.ok(r.body.items.every((i) => i.codigo.startsWith('A-')));
    const p2 = await coord.get('/requests?pageSize=100&page=2');
    assert.equal(p2.body.items.length, 50);
    const p9 = await coord.get('/requests?pageSize=100&page=9');
    assert.equal(p9.body.items.length, 0);
    assert.equal(p9.body.total, 150);
  });

  test('AC-RF08-02 pageSize 101 o 0 responde 422 asociado a pageSize; zona desconocida también 422', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    for (const q of ['pageSize=101', 'pageSize=0', 'pageSize=abc']) {
      const r = await coord.get(`/requests?${q}`);
      assert.equal(r.status, 422, q);
      assert.equal(r.body.error.field, 'pageSize');
    }
    assert.equal((await coord.get('/requests?pageSize=100')).status, 200);
    assert.equal((await coord.get('/requests?zona=MARTE')).body.error.field, 'zona');
    assert.equal((await coord.get('/requests?estado=PERDIDA')).body.error.field, 'estado');
  });

  test('AC-RF08-03 un solicitante S1 solo ve sus solicitudes; ninguna de S2 aparece (listado, detalle y tablero)', async () => {
    const s2 = await H.sesion(app.base, H.CUENTAS.sol2A);
    const deS2 = (await s2.post('/requests', { body: H.borrador() })).body.codigo;
    const s1 = await H.sesion(app.base, H.CUENTAS.solA);
    const lista = await s1.get('/requests?pageSize=100');
    assert.deepEqual(lista.body.items.map((i) => i.codigo).sort(), ['A-001', 'A-002']);
    assert.equal((await s1.get(`/requests/${deS2}`)).status, 403);
    const tablero = await s1.get('/dashboard');
    assert.equal(tablero.body.conteos.BORRADOR, 0);
    assert.equal(tablero.body.conteos.ENVIADA, 2);
    assert.equal((await s1.get('/inventory')).status, 403);
  });

  test('AC-RF08-04 filtros por estado, prioridad y zona; el coordinador de ORG-A consulta B-001 y recibe 404', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    assert.equal((await coord.get('/requests/B-001')).status, 404);
    assert.deepEqual((await coord.get('/requests?prioridad=ALTA')).body.items.map((i) => i.codigo), ['A-001']);
    assert.deepEqual((await coord.get('/requests?zona=SUR')).body.items.map((i) => i.codigo), ['A-002']);
    assert.equal((await coord.get('/requests?estado=RESERVADA')).body.total, 0);
    const bod = await H.sesion(app.base, H.CUENTAS.bodA);
    assert.equal((await bod.get('/requests')).body.total, 2);
    const inv = await bod.get('/inventory');
    assert.equal(inv.status, 200);
    assert.ok(inv.body.items.every((i) => ['KIT-AGUA', 'KIT-ALIMENTO', 'KIT-HIGIENE'].includes(i.sku)) && inv.body.total === 3);
  });

  test('AC-RF08-05 los conteos del tablero coinciden con una consulta directa a la base para ORG-A', async () => {
    await sembrarSolicitudes('ORG-A', 25, H.CUENTAS.solA);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    await coord.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    const r = await coord.get('/dashboard');
    const { rows } = await H.pool.query("SELECT estado, count(*)::int n FROM requests WHERE org_id = 'ORG-A' GROUP BY estado");
    const esperado = { BORRADOR: 0, ENVIADA: 0, RESERVADA: 0, DESPACHADA: 0, ENTREGADA: 0, CANCELADA: 0 };
    for (const x of rows) esperado[x.estado] = x.n;
    assert.deepEqual(r.body.conteos, esperado);
    assert.equal(r.body.conteos.RESERVADA, 1);
  });

  test('AC-RF09-01 reservar crea exactamente 1 evento con todos sus campos, fecha UTC y el correlationId de la petición', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const corr = 'prueba-rf09-' + Date.now();
    const r = await coord.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid(), 'X-Correlation-Id': corr } });
    assert.equal(r.headers.get('x-correlation-id'), corr);
    const ev = await H.eventos({ recursoId: 'A-001' });
    assert.equal(ev.length, 1);
    const coordId = (await H.pool.query('SELECT id FROM users WHERE email = $1', [H.CUENTAS.coordA])).rows[0].id;
    assert.equal(ev[0].actor_id, coordId);
    assert.equal(ev[0].organization_id, 'ORG-A');
    assert.equal(ev[0].recurso, 'solicitud');
    assert.equal(ev[0].accion, 'RESERVAR');
    assert.equal(ev[0].correlation_id, corr);
    assert.ok(Math.abs(ev[0].fecha_utc.getTime() - Date.now()) < 60000);
    const aud = await H.sesion(app.base, H.CUENTAS.audA);
    const api = await aud.get('/audit');
    assert.match(api.body.items[0].fechaUtc, /Z$/);
    assert.deepEqual(Object.keys(api.body.items[0]).sort(), ['accion', 'actorId', 'correlationId', 'fechaUtc', 'id', 'organizacionId', 'recurso', 'recursoId']);
  });

  test('AC-RF09-02 despachar una solicitud ENVIADA responde 409 y el número de eventos no cambia', async () => {
    const bod = await H.sesion(app.base, H.CUENTAS.bodA);
    const antes = (await H.eventos()).length;
    assert.equal((await bod.post('/requests/A-001/dispatch')).status, 409);
    assert.equal((await H.eventos()).length, antes);
  });

  test('AC-RF09-03 PUT, PATCH o DELETE sobre un evento de auditoría responde 405 y el evento queda igual; la base también lo impide', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    await coord.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    const [ev] = await H.eventos({ recursoId: 'A-001' });
    const aud = await H.sesion(app.base, H.CUENTAS.audA);
    assert.equal((await aud.put(`/audit/${ev.id}`, { body: { accion: 'X' } })).status, 405);
    assert.equal((await aud.patch(`/audit/${ev.id}`, { body: { accion: 'X' } })).status, 405);
    assert.equal((await aud.del(`/audit/${ev.id}`)).status, 405);
    await assert.rejects(H.pool.query('UPDATE audit_events SET accion = $1 WHERE id = $2', ['X', ev.id]), /solo inserción/);
    await assert.rejects(H.pool.query('DELETE FROM audit_events WHERE id = $1', [ev.id]), /solo inserción/);
    const [despues] = await H.eventos({ recursoId: 'A-001' });
    assert.deepEqual(despues, ev);
    assert.equal((await coord.get('/audit')).status, 403); // solo el auditor consulta auditoría
  });

  test('AC-RF09-04 si falla la escritura del evento, la transacción se revierte por completo', async () => {
    await H.pool.query(`CREATE OR REPLACE FUNCTION falla_auditoria() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'fallo forzado de auditoría'; END; $$ LANGUAGE plpgsql`);
    await H.pool.query('CREATE TRIGGER tr_falla_auditoria BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION falla_auditoria()');
    try {
      const coord = await H.sesion(app.base, H.CUENTAS.coordA);
      const r = await coord.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
      assert.equal(r.status, 500);
      assert.ok(!JSON.stringify(r.body).includes('fallo forzado')); // no filtra detalles internos
      assert.equal(await H.estadoDe('A-001'), 'ENVIADA');
      assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 0, disponible: 10 });
      assert.equal((await H.pool.query('SELECT count(*)::int n FROM idempotency_keys')).rows[0].n, 0);
    } finally {
      await H.pool.query('DROP TRIGGER tr_falla_auditoria ON audit_events');
      await H.pool.query('DROP FUNCTION falla_auditoria()');
    }
  });

  test('AC-RF09-05 el auditor filtra por rango de fechas UTC; desde > hasta responde 422', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    await coord.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    const aud = await H.sesion(app.base, H.CUENTAS.audA);
    const ayer = new Date(Date.now() - 86400000).toISOString();
    const manana = new Date(Date.now() + 86400000).toISOString();
    assert.equal((await aud.get(`/audit?desde=${ayer}&hasta=${manana}`)).body.total, 1);
    assert.equal((await aud.get(`/audit?desde=${manana}`)).body.total, 0);
    assert.equal((await aud.get(`/audit?desde=${manana}&hasta=${ayer}`)).body.error.field, 'desde');
  });
});
