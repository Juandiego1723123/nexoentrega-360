'use strict';
// SPEC-2 · Solicitudes (RF03, RF04)
const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let app;
before(async () => { app = await H.iniciar(); });
beforeEach(() => H.reset());
after(async () => { await app.cerrar(); });

const lineasDe = async (code) => (await H.pool.query(
  'SELECT p.sku, l.cantidad FROM request_lines l JOIN products p ON p.id = l.product_id WHERE l.request_code = $1 ORDER BY p.sku', [code])).rows;

describe('SPEC-2 · Solicitudes', () => {
  test('AC-RF03-01 enviar un borrador con cantidad 0: 422 en cantidad; borrador, inventario y auditoría sin cambios', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const creado = await sol.post('/requests', { body: H.borrador() });
    assert.equal(creado.status, 201);
    const code = creado.body.codigo;
    const stockAntes = await H.stock('ORG-A', 'KIT-AGUA');
    const eventosAntes = (await H.eventos()).length;
    const r = await sol.post(`/requests/${code}/submit`, { body: H.borrador({ lineas: [{ sku: 'KIT-AGUA', cantidad: 0 }] }) });
    assert.equal(r.status, 422);
    assert.equal(r.body.error.field, 'lineas[0].cantidad');
    assert.equal(await H.estadoDe(code), 'BORRADOR');
    assert.deepEqual(await lineasDe(code), [{ sku: 'KIT-AGUA', cantidad: 2 }]);
    assert.deepEqual(await H.stock('ORG-A', 'KIT-AGUA'), stockAntes);
    assert.equal((await H.eventos()).length, eventosAntes);
  });

  test('AC-RF03-02 límites de cantidad: 1 y 500 válidas; 501, −1 y 2.5 responden 422', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    for (const cantidad of [1, 500]) {
      assert.equal((await sol.post('/requests', { body: H.borrador({ lineas: [{ sku: 'KIT-AGUA', cantidad }] }) })).status, 201, `cantidad ${cantidad}`);
    }
    for (const cantidad of [501, -1, 2.5, 0]) {
      const r = await sol.post('/requests', { body: H.borrador({ lineas: [{ sku: 'KIT-AGUA', cantidad }] }) });
      assert.equal(r.status, 422, `cantidad ${cantidad}`);
      assert.equal(r.body.error.field, 'lineas[0].cantidad');
    }
  });

  test('AC-RF03-03 SKU repetido, 0 líneas u 11 líneas responden 422; 10 líneas pasan la regla de cantidad', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const repetido = await sol.post('/requests', { body: H.borrador({ lineas: [{ sku: 'KIT-AGUA', cantidad: 1 }, { sku: 'KIT-AGUA', cantidad: 2 }] }) });
    assert.equal(repetido.status, 422);
    assert.equal(repetido.body.error.field, 'lineas[1].sku');
    const once = Array.from({ length: 11 }, (_, i) => ({ sku: `SKU-${i}`, cantidad: 1 }));
    assert.equal((await sol.post('/requests', { body: H.borrador({ lineas: once }) })).body.error.field, 'lineas');
    assert.equal((await sol.post('/requests', { body: H.borrador({ lineas: [] }) })).status, 422);
    const diez = Array.from({ length: 10 }, (_, i) => ({ sku: `SKU-${i}`, cantidad: 1 }));
    const r10 = await sol.post('/requests', { body: H.borrador({ lineas: diez }) });
    assert.equal(r10.status, 422);
    assert.equal(r10.body.error.field, 'lineas[0].sku'); // 10 líneas son válidas en número; falla porque SKU-0 no existe
    const inactivo = await H.pool.query("UPDATE products SET active = false WHERE org_id = 'ORG-A' AND sku = 'KIT-HIGIENE'");
    assert.equal(inactivo.rowCount, 1);
    assert.equal((await sol.post('/requests', { body: H.borrador({ lineas: [{ sku: 'KIT-HIGIENE', cantidad: 1 }] }) })).status, 422);
  });

  test('AC-RF03-04 una fecha requerida anterior al momento del envío responde 422 y no envía', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const pasado = new Date(Date.now() - 3600000).toISOString();
    const creado = await sol.post('/requests', { body: H.borrador({ fechaRequerida: pasado }) });
    assert.equal(creado.status, 201); // el borrador se puede guardar; la regla se exige al enviar
    const r = await sol.post(`/requests/${creado.body.codigo}/submit`);
    assert.equal(r.status, 422);
    assert.equal(r.body.error.field, 'fechaRequerida');
    assert.equal(await H.estadoDe(creado.body.codigo), 'BORRADOR');
    const obs = await sol.post('/requests', { body: H.borrador({ observaciones: 'x'.repeat(501) }) });
    assert.equal(obs.body.error.field, 'observaciones');
    assert.equal((await sol.post('/requests', { body: H.borrador({ observaciones: 'x'.repeat(500) }) })).status, 201);
  });

  test('AC-RF03-05 crear un borrador válido: 201, código único y estado BORRADOR', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const a = await sol.post('/requests', { body: H.borrador() });
    const b = await sol.post('/requests', { body: H.borrador() });
    assert.equal(a.status, 201);
    assert.equal(a.body.estado, 'BORRADOR');
    assert.equal(a.body.codigo, 'A-003');
    assert.equal(b.body.codigo, 'A-004');
    assert.equal(a.body.organizacion, 'ORG-A');
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    assert.equal((await coord.post('/requests', { body: H.borrador() })).status, 403);
    const solB = await H.sesion(app.base, H.CUENTAS.solB);
    assert.equal((await solB.post('/requests', { body: H.borrador() })).body.codigo, 'B-002');
  });

  test('AC-RF04-01 editar una solicitud ENVIADA responde 409 y los datos no cambian', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const antes = await lineasDe('A-001');
    const r = await sol.put('/requests/A-001', { body: H.borrador({ lineas: [{ sku: 'KIT-AGUA', cantidad: 1 }] }) });
    assert.equal(r.status, 409);
    assert.deepEqual(await lineasDe('A-001'), antes);
    const borr = await sol.post('/requests', { body: H.borrador() });
    const ed = await sol.put(`/requests/${borr.body.codigo}`, { body: H.borrador({ prioridad: 'ALTA', lineas: [{ sku: 'KIT-HIGIENE', cantidad: 3 }] }) });
    assert.equal(ed.status, 200);
    assert.deepEqual(await lineasDe(borr.body.codigo), [{ sku: 'KIT-HIGIENE', cantidad: 3 }]);
  });

  test('AC-RF04-02 registrar la entrega de una solicitud ENVIADA responde 409', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await coord.post('/requests/A-001/deliver');
    assert.equal(r.status, 409);
    assert.equal(await H.estadoDe('A-001'), 'ENVIADA');
  });

  test('AC-RF04-03 un solicitante intenta cancelar la solicitud de otro solicitante de su organización: 403', async () => {
    const otro = await H.sesion(app.base, H.CUENTAS.sol2A);
    assert.equal((await otro.post('/requests/A-001/cancel')).status, 403);
    assert.equal((await otro.get('/requests/A-001')).status, 403);
    assert.equal(await H.estadoDe('A-001'), 'ENVIADA');
  });

  test('AC-RF04-04 flujo BORRADOR → ENVIADA → RESERVADA → DESPACHADA → ENTREGADA con 4 eventos de transición', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const bod = await H.sesion(app.base, H.CUENTAS.bodA);
    const code = (await sol.post('/requests', { body: H.borrador({ lineas: [{ sku: 'KIT-AGUA', cantidad: 4 }] }) })).body.codigo;
    assert.equal((await sol.post(`/requests/${code}/submit`)).body.estado, 'ENVIADA');
    assert.equal((await coord.post(`/requests/${code}/reserve`, { headers: { 'Idempotency-Key': H.uuid() } })).body.estado, 'RESERVADA');
    assert.equal((await bod.post(`/requests/${code}/dispatch`)).body.estado, 'DESPACHADA');
    assert.equal((await coord.post(`/requests/${code}/deliver`)).body.estado, 'ENTREGADA');
    const ev = await H.eventos({ recursoId: code });
    assert.deepEqual(ev.map((e) => e.accion), ['ENVIAR', 'RESERVAR', 'DESPACHAR', 'ENTREGAR']);
    assert.deepEqual(await H.stock('ORG-A', 'KIT-AGUA'), { fisico: 16, reservado: 0, disponible: 16 });
    assert.equal((await sol.post(`/requests/${code}/cancel`)).status, 409); // ENTREGADA es terminal
  });
});
