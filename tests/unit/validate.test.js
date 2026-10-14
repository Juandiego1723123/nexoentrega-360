'use strict';
// Pruebas unitarias del validador de SPEC-2 y SPEC-4 (sin base de datos).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarSolicitud, validarPaginacion, validarFiltros } = require('../../apps/api/src/validate');

const base = (x = {}) => ({ zona: 'NORTE', prioridad: 'ALTA', fechaRequerida: '2030-01-11T14:00:00Z', lineas: [{ sku: 'KIT-AGUA', cantidad: 1 }], ...x });
const campo = (fn) => { try { fn(); return null; } catch (e) { return e.field; } };

test('UT-01 cantidades: 1 y 500 válidas; 0, 501, -1, 2.5 y texto inválidas', () => {
  for (const c of [1, 500]) assert.equal(campo(() => validarSolicitud(base({ lineas: [{ sku: 'X', cantidad: c }] }))), null);
  for (const c of [0, 501, -1, 2.5, '3']) assert.equal(campo(() => validarSolicitud(base({ lineas: [{ sku: 'X', cantidad: c }] }))), 'lineas[0].cantidad');
});

test('UT-02 líneas: 0 y 11 inválidas, 10 válidas, SKU repetido inválido', () => {
  const n = (k) => Array.from({ length: k }, (_, i) => ({ sku: `S${i}`, cantidad: 1 }));
  assert.equal(campo(() => validarSolicitud(base({ lineas: n(0) }))), 'lineas');
  assert.equal(campo(() => validarSolicitud(base({ lineas: n(11) }))), 'lineas');
  assert.equal(campo(() => validarSolicitud(base({ lineas: n(10) }))), null);
  assert.equal(campo(() => validarSolicitud(base({ lineas: [{ sku: 'A', cantidad: 1 }, { sku: 'A', cantidad: 1 }] }))), 'lineas[1].sku');
});

test('UT-03 fecha: anterior al envío inválida, igual al envío válida; observaciones 500/501', () => {
  const ahora = new Date('2030-01-10T14:00:00Z');
  assert.equal(campo(() => validarSolicitud(base({ fechaRequerida: '2030-01-10T13:59:59Z' }), { ahora })), 'fechaRequerida');
  assert.equal(campo(() => validarSolicitud(base({ fechaRequerida: '2030-01-10T14:00:00Z' }), { ahora })), null);
  assert.equal(campo(() => validarSolicitud(base({ fechaRequerida: 'mañana' }))), 'fechaRequerida');
  assert.equal(campo(() => validarSolicitud(base({ observaciones: 'x'.repeat(500) }))), null);
  assert.equal(campo(() => validarSolicitud(base({ observaciones: 'x'.repeat(501) }))), 'observaciones');
  assert.equal(campo(() => validarSolicitud(base({ zona: 'MARTE' }))), 'zona');
  assert.equal(campo(() => validarSolicitud(base({ prioridad: 'URGENTE' }))), 'prioridad');
});

test('UT-04 paginación: pageSize 1 y 100 válidos; 0 y 101 inválidos; valores por defecto', () => {
  assert.deepEqual(validarPaginacion({}), { page: 1, pageSize: 20 });
  assert.deepEqual(validarPaginacion({ pageSize: '100' }), { page: 1, pageSize: 100 });
  assert.equal(campo(() => validarPaginacion({ pageSize: '0' })), 'pageSize');
  assert.equal(campo(() => validarPaginacion({ pageSize: '101' })), 'pageSize');
  assert.equal(campo(() => validarPaginacion({ page: '0' })), 'page');
  assert.equal(campo(() => validarFiltros({ zona: 'X' })), 'zona');
});
