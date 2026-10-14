'use strict';
// SPEC-1 · Identidad y permisos (RF01, RF02, RNF01)
const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let app;
before(async () => { app = await H.iniciar(); });
beforeEach(() => H.reset());
after(async () => { await app.cerrar(); });

describe('SPEC-1 · Identidad y permisos', () => {
  test('AC-RF01-01 login del coordinador de ORG-A: 200, cookie HttpOnly y /auth/me con rol y organización', async () => {
    const c = H.cliente(app.base);
    const r = await c.post('/auth/login', { body: { email: H.CUENTAS.coordA, password: H.PASSWORD } });
    assert.equal(r.status, 200);
    assert.deepEqual({ rol: r.body.rol, org: r.body.organizacion }, { rol: 'COORDINADOR', org: 'ORG-A' });
    const sc = r.headers.get('set-cookie');
    assert.match(sc, /HttpOnly/i);
    assert.match(sc, /SameSite=Lax/i);
    const me = await c.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.rol, 'COORDINADOR');
    assert.equal(me.body.organizacion, 'ORG-A');
  });

  test('AC-RF01-02 contraseña incorrecta o correo inexistente: mismo 401 genérico y no se crea sesión', async () => {
    const antes = (await H.pool.query('SELECT count(*)::int n FROM sessions')).rows[0].n;
    const c = H.cliente(app.base);
    const a = await c.post('/auth/login', { body: { email: H.CUENTAS.coordA, password: 'incorrecta123' } });
    const b = await c.post('/auth/login', { body: { email: 'no-existe@example.test', password: 'incorrecta123' } });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error.message, b.body.error.message);
    assert.equal(c.cookie, null);
    assert.equal((await H.pool.query('SELECT count(*)::int n FROM sessions')).rows[0].n, antes);
  });

  test('AC-RF01-03 después de cerrar sesión, la cookie anterior recibe 401', async () => {
    const c = await H.sesion(app.base, H.CUENTAS.coordA);
    const vieja = c.cookie;
    assert.equal((await c.post('/auth/logout')).status, 204);
    c.cookie = vieja;
    assert.equal((await c.get('/auth/me')).status, 401);
    assert.equal((await c.get('/requests')).status, 401);
  });

  test('AC-RF01-04 password_hash es bcrypt y no contiene la contraseña en texto plano', async () => {
    const { rows } = await H.pool.query('SELECT password_hash FROM users');
    assert.ok(rows.length >= 8);
    for (const r of rows) {
      assert.match(r.password_hash, /^\$2[aby]\$10\$/);
      assert.ok(!r.password_hash.includes(H.PASSWORD));
    }
    const s = await H.pool.query('SELECT token_hash FROM sessions');
    for (const r of s.rows) assert.match(r.token_hash, /^[0-9a-f]{64}$/);
  });

  test('AC-RF02-01 lectura cruzada: el coordinador de ORG-A pide B-001 y recibe 404 sin datos', async () => {
    const c = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await c.get('/requests/B-001');
    assert.equal(r.status, 404);
    assert.ok(!JSON.stringify(r.body).includes('ORG-B'));
    assert.ok(!JSON.stringify(r.body).includes('exclusivo'));
  });

  test('AC-RF02-02 lectura cruzada: la auditoría de ORG-A no muestra eventos de ORG-B', async () => {
    const coordB = await H.sesion(app.base, H.CUENTAS.coordB);
    assert.equal((await coordB.post('/requests/B-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } })).status, 200);
    const audA = await H.sesion(app.base, H.CUENTAS.audA);
    const r = await audA.get('/audit?pageSize=100');
    assert.equal(r.status, 200);
    assert.ok(r.body.items.every((e) => e.organizacionId === 'ORG-A'));
    assert.ok(!r.body.items.some((e) => e.recursoId === 'B-001'));
    assert.equal((await H.eventos({ org: 'ORG-B' })).length, 1);
  });

  test('AC-RF02-03 escritura cruzada: el coordinador de ORG-A intenta reservar B-001: 404 e inventario de ORG-B igual', async () => {
    const antes = await H.stock('ORG-B', 'KIT-HIGIENE');
    const c = await H.sesion(app.base, H.CUENTAS.coordA);
    const r = await c.post('/requests/B-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    assert.equal(r.status, 404);
    assert.deepEqual(await H.stock('ORG-B', 'KIT-HIGIENE'), antes);
    assert.equal(await H.estadoDe('B-001'), 'ENVIADA');
    assert.equal((await H.pool.query('SELECT count(*)::int n FROM idempotency_keys')).rows[0].n, 0);
  });

  test('AC-RF02-04 escritura cruzada: la bodega de ORG-A intenta despachar B-001: 404 y nada cambia', async () => {
    const coordB = await H.sesion(app.base, H.CUENTAS.coordB);
    await coordB.post('/requests/B-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    const antes = await H.stock('ORG-B', 'KIT-HIGIENE');
    const bodA = await H.sesion(app.base, H.CUENTAS.bodA);
    assert.equal((await bodA.post('/requests/B-001/dispatch')).status, 404);
    assert.equal(await H.estadoDe('B-001'), 'RESERVADA');
    assert.deepEqual(await H.stock('ORG-B', 'KIT-HIGIENE'), antes);
  });

  test('AC-RF02-05 la bodega de ORG-A intenta reservar A-001 (propia organización): 403', async () => {
    const c = await H.sesion(app.base, H.CUENTAS.bodA);
    const r = await c.post('/requests/A-001/reserve', { headers: { 'Idempotency-Key': H.uuid() } });
    assert.equal(r.status, 403);
    assert.equal(await H.estadoDe('A-001'), 'ENVIADA');
  });

  test('AC-RNF01-01 todo endpoint protegido sin sesión responde 401', async () => {
    const c = H.cliente(app.base);
    const rutas = [
      ['GET', '/auth/me'], ['POST', '/auth/logout'], ['GET', '/requests'], ['GET', '/requests/A-001'], ['POST', '/requests'],
      ['PUT', '/requests/A-001'], ['POST', '/requests/A-001/submit'], ['POST', '/requests/A-001/reserve'],
      ['POST', '/requests/A-001/dispatch'], ['POST', '/requests/A-001/deliver'], ['POST', '/requests/A-001/cancel'],
      ['GET', '/catalog'], ['GET', '/dashboard'], ['GET', '/inventory'], ['GET', '/audit'],
      ['POST', '/ai/summaries'], ['GET', '/ai/summaries/1'], ['POST', '/ai/summaries/1/approve'],
    ];
    for (const [m, r] of rutas) {
      const res = await c.pedir(m, r, m === 'GET' ? {} : { body: {} });
      assert.equal(res.status, 401, `${m} ${r}`);
    }
    assert.equal((await c.get('/health')).status, 200);
  });
});
