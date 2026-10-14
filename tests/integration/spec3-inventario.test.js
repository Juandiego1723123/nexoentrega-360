'use strict';
// SPEC-3 · Inventario y transiciones (RF05, RF06, RF07, RNF02). Oráculos del anexo acceptance-oracles.md.
const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let app;
before(async () => { app = await H.iniciar(); });
beforeEach(() => H.reset());
after(async () => { await app.cerrar(); });

const reservar = (c, code, key = H.uuid(), body) => c.post(`/requests/${code}/reserve`, { headers: { 'Idempotency-Key': key }, body });

describe('SPEC-3 · Inventario y transiciones', () => {
  test('AC-RF05-01 reservar A-001 (7 de KIT-ALIMENTO): 200, físico 10, reservado 7, disponible 3, RESERVADA y 1 evento', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await reservar(coord, 'A-001');
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'RESERVADA');
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 7, disponible: 3 });
    assert.deepEqual(r.body.inventario, [{ sku: 'KIT-ALIMENTO', existenciaFisica: 10, reservada: 7, disponible: 3 }]);
    assert.equal(await H.estadoDe('A-001'), 'RESERVADA');
    assert.equal((await H.eventos({ recursoId: 'A-001' })).length, 1);
  });

  test('AC-RF05-02 una línea suficiente y otra insuficiente: 409 y ninguna línea ni el estado cambian', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const code = (await sol.post('/requests', { body: H.borrador({ lineas: [{ sku: 'KIT-ALIMENTO', cantidad: 2 }, { sku: 'KIT-HIGIENE', cantidad: 9 }] }) })).body.codigo;
    await sol.post(`/requests/${code}/submit`);
    const r = await reservar(coord, code);
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'STOCK_INSUFICIENTE');
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 0, disponible: 10 });
    assert.deepEqual(await H.stock('ORG-A', 'KIT-HIGIENE'), { fisico: 8, reservado: 0, disponible: 8 });
    assert.equal(await H.estadoDe(code), 'ENVIADA');
    assert.equal((await H.eventos({ recursoId: code })).map((e) => e.accion).join(), 'ENVIAR');
  });

  test('AC-RF05-03 reservar una solicitud en BORRADOR responde 409', async () => {
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const code = (await sol.post('/requests', { body: H.borrador() })).body.codigo;
    assert.equal((await reservar(coord, code)).status, 409);
    assert.equal(await H.estadoDe(code), 'BORRADOR');
    assert.deepEqual(await H.stock('ORG-A', 'KIT-AGUA'), { fisico: 20, reservado: 0, disponible: 20 });
  });

  test('AC-RF06-01 cancelar A-001 RESERVADA libera exactamente su reserva: físico 10, reservado 0, disponible 10', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const sol = await H.sesion(app.base, H.CUENTAS.solA);
    await reservar(coord, 'A-001');
    const r = await sol.post('/requests/A-001/cancel');
    assert.equal(r.status, 200);
    assert.equal(r.body.estado, 'CANCELADA');
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 0, disponible: 10 });
    const env = await sol.post('/requests/A-002/cancel'); // cancelar una ENVIADA no altera inventario
    assert.equal(env.status, 200);
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 0, disponible: 10 });
  });

  test('AC-RF06-02 despachar A-001 RESERVADA: físico 3, reservado 0, disponible 3', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const bod = await H.sesion(app.base, H.CUENTAS.bodA);
    await reservar(coord, 'A-001');
    const r = await bod.post('/requests/A-001/dispatch');
    assert.equal(r.status, 200);
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 3, reservado: 0, disponible: 3 });
    assert.equal((await bod.post('/requests/A-002/dispatch')).status, 409); // despachar una ENVIADA
  });

  test('AC-RF06-03 registrar ENTREGADA no cambia ninguna cantidad de inventario', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const bod = await H.sesion(app.base, H.CUENTAS.bodA);
    await reservar(coord, 'A-001');
    await bod.post('/requests/A-001/dispatch');
    const antes = await H.stock('ORG-A', 'KIT-ALIMENTO');
    assert.equal((await coord.post('/requests/A-001/deliver')).status, 200);
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), antes);
  });

  test('AC-RF07-01 repetir con la misma clave y contenido devuelve la misma respuesta: una reserva y un evento', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const key = H.uuid();
    const a = await reservar(coord, 'A-001', key);
    const b = await reservar(coord, 'A-001', key);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(b.body, a.body);
    assert.equal(b.headers.get('idempotent-replayed'), 'true');
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 7, disponible: 3 });
    assert.equal((await H.eventos({ recursoId: 'A-001' })).length, 1);
  });

  test('AC-RF07-02 la misma clave con contenido diferente responde 409', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const key = H.uuid();
    assert.equal((await reservar(coord, 'A-001', key)).status, 200);
    const r = await reservar(coord, 'A-002', key);
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'IDEMPOTENCIA_CONFLICTO');
    assert.equal(await H.estadoDe('A-002'), 'ENVIADA');
    const r2 = await reservar(coord, 'A-001', key, { nota: 'otro contenido' });
    assert.equal(r2.status, 409);
  });

  test('AC-RF07-03 concurrencia: A-001 y A-002 simultáneas sobre disponible 10: una 200, otra 409; reservado 7 (5 rondas)', async () => {
    for (let ronda = 1; ronda <= 5; ronda++) {
      await H.reset();
      const c1 = await H.sesion(app.base, H.CUENTAS.coordA);
      const c2 = await H.sesion(app.base, H.CUENTAS.coordA);
      const [a, b] = await Promise.all([reservar(c1, 'A-001'), reservar(c2, 'A-002')]);
      const estados = [a.status, b.status].sort();
      assert.deepEqual(estados, [200, 409], `ronda ${ronda}: ${estados}`);
      assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 7, disponible: 3 }, `ronda ${ronda}`);
      assert.equal((await H.eventos({ org: 'ORG-A' })).length, 1, `ronda ${ronda}`);
    }
  });

  test('AC-RF07-03b la misma clave enviada dos veces en simultáneo produce un solo efecto y un evento', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const key = H.uuid();
    const [a, b] = await Promise.all([reservar(coord, 'A-001', key), reservar(coord, 'A-001', key)]);
    assert.deepEqual([a.status, b.status], [200, 200]);
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 7, disponible: 3 });
    assert.equal((await H.eventos({ recursoId: 'A-001' })).length, 1);
  });

  test('AC-RF07-04 una segunda reserva de la misma solicitud con otra clave responde 409', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    assert.equal((await reservar(coord, 'A-001')).status, 200);
    const r = await reservar(coord, 'A-001');
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'TRANSICION_INVALIDA');
    assert.deepEqual(await H.stock('ORG-A', 'KIT-ALIMENTO'), { fisico: 10, reservado: 7, disponible: 3 });
  });

  test('AC-RF07-05 contrato de idempotencia: sin clave 422; 403 y 404 no se guardan; una clave no recupera la respuesta de otro usuario', async () => {
    const coord = await H.sesion(app.base, H.CUENTAS.coordA);
    const sinClave = await coord.post('/requests/A-001/reserve');
    assert.equal(sinClave.status, 422);
    assert.equal(sinClave.body.error.field, 'Idempotency-Key');
    const key = H.uuid();
    const bod = await H.sesion(app.base, H.CUENTAS.bodA);
    assert.equal((await reservar(bod, 'A-001', key)).status, 403);
    assert.equal((await reservar(coord, 'B-001', key)).status, 404);
    assert.equal((await H.pool.query('SELECT count(*)::int n FROM idempotency_keys')).rows[0].n, 0);
    assert.equal((await reservar(coord, 'A-001', key)).status, 200);
    const coordB = await H.sesion(app.base, H.CUENTAS.coordB);
    const otra = await reservar(coordB, 'B-001', key); // misma clave, otro usuario: operación independiente
    assert.equal(otra.status, 200);
    assert.equal(otra.body.codigo, 'B-001');
    const guardada = (await H.pool.query('SELECT expires_at - created_at AS ttl FROM idempotency_keys LIMIT 1')).rows[0].ttl;
    assert.ok(guardada.hours >= 24 || guardada.days >= 1);
  });

  test('AC-RNF02-01 consistencia: la base rechaza existencias o reservas negativas y ninguna prueba las deja', async () => {
    await assert.rejects(H.pool.query("UPDATE inventory SET reserved = -1"), /ck_inventory_reserved/);
    await assert.rejects(H.pool.query("UPDATE inventory SET on_hand = -1"), /ck_inventory/);
    await assert.rejects(H.pool.query("UPDATE inventory SET reserved = on_hand + 1"), /ck_inventory_disponible/);
    const { rows } = await H.pool.query('SELECT min(on_hand) AS f, min(reserved) AS r, min(on_hand - reserved) AS d FROM inventory');
    assert.ok(rows[0].f >= 0 && rows[0].r >= 0 && rows[0].d >= 0);
  });
});
