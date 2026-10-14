'use strict';
// SPEC-5 · Asistente de IA (RF10, RF11, RF12, RNF06) con los 7 fixtures del anexo ai-provider-fixtures.json.
const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');
const { proveedorFixture, proveedorNinguno } = require('../../apps/api/src/ai/providers');

let app;
before(async () => { app = await H.iniciar(); });
beforeEach(async () => { await H.reset(); app.usarProveedor(proveedorNinguno); });
after(async () => { await app.cerrar(); });

// Adaptador simulado que registra exactamente lo que recibe (AC-RF10-01).
function espia(respuesta) {
  const p = { nombre: 'espia', llamadas: [], async generar(sol) { p.llamadas.push(JSON.parse(JSON.stringify(sol))); return respuesta(sol); } };
  return p;
}
const validaPara = (ids) => () => JSON.stringify({
  summary: `Resumen de ${ids.length} solicitudes.`,
  recommendations: ids.slice(0, 5).map((id) => ({ requestId: id, reason: 'Revisar primero.', evidenceFields: ['prioridad'] })),
});

async function crearEnviadas(n) {
  const sol = await H.sesion(app.base, H.CUENTAS.solA);
  const ids = [];
  for (let i = 0; i < n; i++) {
    const code = (await sol.post('/requests', { body: H.borrador({ observaciones: `obs ${i}` }) })).body.codigo;
    await sol.post(`/requests/${code}/submit`);
    ids.push(code);
  }
  return ids;
}
const foto = async () => ({
  inv: (await H.pool.query('SELECT product_id, on_hand, reserved FROM inventory ORDER BY product_id')).rows,
  req: (await H.pool.query('SELECT code, estado, prioridad FROM requests ORDER BY code')).rows,
});

describe('SPEC-5 · Asistente de IA', () => {
  test('AC-RF10-01 resumen de 3 ENVIADA: 201, borrador «Asistencia de IA» y el adaptador solo recibe campos permitidos', async () => {
    const ids = ['A-001', 'A-002', ...(await crearEnviadas(1))];
    const p = espia(validaPara(ids));
    app.usarProveedor(p);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await coord.post('/ai/summaries', { body: { requestIds: ids } });
    assert.equal(r.status, 201);
    assert.equal(r.body.etiqueta, 'Asistencia de IA');
    assert.equal(r.body.estado, 'BORRADOR');
    assert.equal(r.body.origen, 'IA');
    assert.equal(p.llamadas.length, 1);
    for (const s of p.llamadas[0]) {
      assert.deepEqual(Object.keys(s).sort(), ['estado', 'fechaRequerida', 'observaciones', 'prioridad', 'requestId', 'zona']);
    }
    const enviado = JSON.stringify(p.llamadas[0]);
    for (const prohibido of ['Solicitante', 'example.test', 'password', 'ORG-B', '$2a$']) assert.ok(!enviado.includes(prohibido), prohibido);
  });

  test('AC-RF10-02 con 20 IDs responde 201; con 21 o lista vacía responde 422 y el adaptador no se invoca', async () => {
    const ids = await crearEnviadas(21);
    const p = espia(validaPara(ids));
    app.usarProveedor(p);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: ids.slice(0, 20) } })).status, 201);
    assert.equal(p.llamadas.length, 1);
    const r21 = await coord.post('/ai/summaries', { body: { requestIds: ids } });
    assert.equal(r21.status, 422);
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: [] } })).status, 422);
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-001'] } })).status, 422);
    assert.equal(p.llamadas.length, 1);
  });

  test('AC-RF10-03 si un ID pertenece a ORG-B la petición se rechaza y el adaptador no se invoca', async () => {
    const p = espia(validaPara(['A-001']));
    app.usarProveedor(p);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'B-001'] } });
    assert.equal(r.status, 422);
    const inexistente = await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-999'] } });
    assert.equal(inexistente.body.error.message, r.body.error.message); // no revela que B-001 existe
    assert.equal(p.llamadas.length, 0);
  });

  test('AC-RF10-04 si un ID está RESERVADA responde 422', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    await coord.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    const r = await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-002'] } });
    assert.equal(r.status, 422);
    assert.equal(r.body.error.field, 'requestIds');
  });

  test('AC-RF10-05 solicitante, bodega y auditor reciben 403 al pedir o aprobar un resumen', async () => {
    app.usarProveedor(proveedorFixture('AI-VALID'));
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const id = (await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-002'] } })).body.id;
    for (const email of [H.CUENTAS.solA, H.CUENTAS.bodA, H.CUENTAS.audA]) {
      const c = await H.sesion(app.base, email);
      assert.equal((await c.post('/ai/summaries', { body: { requestIds: ['A-001'] } })).status, 403, email);
      assert.equal((await c.post(`/ai/summaries/${id}/approve`)).status, 403, email);
    }
    const coordB = await H.sesion(app.base, H.CUENTAS.coordB);
    assert.equal((await coordB.post(`/ai/summaries/${id}/approve`)).status, 404);
  });

  test('AC-RF11-01 fixtures del anexo (AI-TIMEOUT va en AC-RF12-01): solo AI-VALID se acepta; el resto entrega el determinista sin datos ajenos', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const esperado = { 'AI-VALID': 'IA', 'AI-JSON-BAD': 'DETERMINISTA', 'AI-FOREIGN-ID': 'DETERMINISTA', 'AI-EXTRA': 'DETERMINISTA', 'AI-ERROR': 'DETERMINISTA', 'AI-INJECTION': 'DETERMINISTA' };
    for (const [fixture, origen] of Object.entries(esperado)) {
      app.usarProveedor(proveedorFixture(fixture));
      const antes = await foto();
      const r = await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-002'] } });
      assert.equal(r.status, 201, fixture);
      assert.equal(r.body.origen, origen, fixture);
      assert.ok(!JSON.stringify(r.body).includes('B-001'), `${fixture} filtra datos de ORG-B`);
      assert.ok(!JSON.stringify(r.body).includes('reserve-all'), fixture);
      assert.ok(r.body.recommendations.every((x) => ['A-001', 'A-002'].includes(x.requestId)), fixture);
      assert.deepEqual(await foto(), antes, `${fixture} mutó inventario o solicitudes`);
      if (origen === 'DETERMINISTA') assert.ok(r.body.aviso, fixture);
    }
    const motivos = (await H.pool.query('SELECT motivo_fallo FROM ai_summaries ORDER BY id')).rows.map((x) => x.motivo_fallo);
    assert.deepEqual(motivos, [null, 'JSON_INVALIDO', 'ID_AJENO: B-001', 'ESQUEMA: / must NOT have additional properties', 'ERROR_PROVEEDOR', 'ID_AJENO: B-001']);
  });

  test('AC-RF11-02 un summary de 601 caracteres o una propiedad adicional invalidan la salida; 600 es válido', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const con = (summary, extra = {}) => espia(() => JSON.stringify({ summary, recommendations: [{ requestId: 'A-001', reason: 'ok', evidenceFields: ['zona'], ...extra }] }));
    app.usarProveedor(con('x'.repeat(600)));
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: ['A-001'] } })).body.origen, 'IA');
    app.usarProveedor(con('x'.repeat(601)));
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: ['A-001'] } })).body.origen, 'DETERMINISTA');
    app.usarProveedor(con('ok', { prioridadNueva: 'ALTA' }));
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: ['A-001'] } })).body.origen, 'DETERMINISTA');
    app.usarProveedor(espia(() => JSON.stringify({ summary: 'ok', recommendations: [1, 2, 3, 4, 5, 6].map(() => ({ requestId: 'A-001', reason: 'r', evidenceFields: ['zona'] })) })));
    assert.equal((await coord.post('/ai/summaries', { body: { requestIds: ['A-001'] } })).body.origen, 'DETERMINISTA');
  });

  test('AC-RF11-03 un texto con <script> no se acepta ni se ejecuta: se descarta la salida', async () => {
    app.usarProveedor(espia(() => JSON.stringify({ summary: '<script>window.__unsafe=true</script>', recommendations: [] })));
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await coord.post('/ai/summaries', { body: { requestIds: ['A-001'] } });
    assert.equal(r.body.origen, 'DETERMINISTA');
    assert.ok(!r.body.summary.includes('<script'));
    assert.equal((await H.pool.query('SELECT motivo_fallo FROM ai_summaries')).rows[0].motivo_fallo, 'CONTENIDO_ACTIVO');
  });

  test('AC-RF12-01 si el adaptador tarda más de 5 s (AI-TIMEOUT), a los 5 s se entrega el determinista y el sistema sigue respondiendo', async () => {
    app.usarProveedor(proveedorFixture('AI-TIMEOUT'));
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const t0 = Date.now();
    const pendiente = coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-002'] } });
    await new Promise((r) => setTimeout(r, 300));
    const mientras = await coord.get('/requests'); // el resto del sistema responde durante la espera
    assert.equal(mientras.status, 200);
    const r = await pendiente;
    const ms = Date.now() - t0;
    assert.equal(r.status, 201);
    assert.equal(r.body.origen, 'DETERMINISTA');
    assert.ok(ms >= 4900 && ms < 6500, `tardó ${ms} ms`);
    assert.equal((await H.pool.query('SELECT motivo_fallo FROM ai_summaries')).rows[0].motivo_fallo, 'TIMEOUT');
    assert.deepEqual(r.body.recommendations.map((x) => x.requestId), ['A-001', 'A-002']); // ALTA primero
  });

  test('AC-RF12-02 al aprobar: APROBADO, 1 evento y solicitudes, existencias y prioridades no cambian', async () => {
    app.usarProveedor(proveedorFixture('AI-VALID'));
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const id = (await coord.post('/ai/summaries', { body: { requestIds: ['A-001', 'A-002'] } })).body.id;
    const antes = await foto();
    const eventosAntes = (await H.eventos()).length;
    const r = await coord.post(`/ai/summaries/${id}/approve`);
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'APROBADO');
    const ev = await H.eventos();
    assert.equal(ev.length, eventosAntes + 1);
    assert.equal(ev.at(-1).accion, 'APROBAR_RESUMEN');
    assert.deepEqual(await foto(), antes);
    assert.equal((await coord.post(`/ai/summaries/${id}/approve`)).status, 409);
    assert.equal((await coord.get(`/ai/summaries/${id}`)).body.estado, 'APROBADO');
  });

  test('AC-RNF06-01 sin proveedor el asistente responde con el determinista; health y ready diferenciados', async () => {
    app.usarProveedor(proveedorNinguno);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await coord.post('/ai/summaries', { body: { requestIds: ['A-001'] } });
    assert.equal(r.body.origen, 'DETERMINISTA');
    assert.match(r.body.aviso, /sin proveedor/i);
    const c = H.cliente(app.base);
    assert.deepEqual((await c.get('/health')).body, { status: 'ok' });
    assert.deepEqual((await c.get('/ready')).body, { status: 'ready' });
  });
});
