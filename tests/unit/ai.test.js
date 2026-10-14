'use strict';
// Pruebas unitarias del validador de salida de IA y del resumen determinista (fixtures del anexo).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarSalida } = require('../../apps/api/src/ai/validator');
const { resumenDeterminista } = require('../../apps/api/src/ai/fallback');
const fixtures = require('../../apps/api/src/ai/fixtures.json').fixtures;

const raw = (id) => fixtures.find((f) => f.id === id).rawOutput;

test('UT-05 validador: AI-VALID aceptado; JSON-BAD, FOREIGN-ID, EXTRA e INJECTION rechazados', () => {
  assert.equal(validarSalida(raw('AI-VALID'), ['A-001', 'A-002']).ok, true);
  assert.equal(validarSalida(raw('AI-JSON-BAD'), ['A-001']).motivo, 'JSON_INVALIDO');
  assert.match(validarSalida(raw('AI-FOREIGN-ID'), ['A-001', 'A-002']).motivo, /^ID_AJENO/);
  assert.match(validarSalida(raw('AI-EXTRA'), ['A-001', 'A-002']).motivo, /additional properties/);
  assert.equal(validarSalida(raw('AI-INJECTION'), ['A-001', 'B-001']).motivo, 'CONTENIDO_ACTIVO');
  assert.match(validarSalida(raw('AI-VALID'), ['A-002']).motivo, /^ID_AJENO/); // A-001 no fue enviado
});

test('UT-06 validador: duplicados, más de 5 recomendaciones, evidenceFields fuera de la lista', () => {
  const r = (recs) => JSON.stringify({ summary: 's', recommendations: recs });
  const rec = (id, ev = ['zona']) => ({ requestId: id, reason: 'r', evidenceFields: ev });
  assert.match(validarSalida(r([rec('A'), rec('A')]), ['A']).motivo, /^ID_DUPLICADO/);
  assert.equal(validarSalida(r(['A', 'B', 'C', 'D', 'E', 'F'].map((x) => rec(x))), ['A', 'B', 'C', 'D', 'E', 'F']).ok, false);
  assert.equal(validarSalida(r([rec('A', ['nombre'])]), ['A']).ok, false);
  assert.equal(validarSalida(r([rec('A', ['zona', 'zona'])]), ['A']).ok, false);
  assert.equal(validarSalida(r([rec('A', ['zona', 'prioridad', 'fechaRequerida'])]), ['A']).ok, true);
});

test('UT-07 resumen determinista: ALTA primero, luego fecha; máximo 5; siempre cumple el esquema', () => {
  const s = (id, prioridad, fecha, zona = 'NORTE') => ({ requestId: id, prioridad, fechaRequerida: fecha, zona, estado: 'ENVIADA', observaciones: null });
  const out = resumenDeterminista([
    s('A-3', 'NORMAL', '2030-01-01T00:00:00Z'), s('A-1', 'ALTA', '2030-01-05T00:00:00Z', 'SUR'),
    s('A-2', 'ALTA', '2030-01-02T00:00:00Z'), s('A-4', 'NORMAL', '2030-01-03T00:00:00Z'),
    s('A-5', 'NORMAL', '2030-01-04T00:00:00Z'), s('A-6', 'NORMAL', '2030-01-09T00:00:00Z'),
  ]);
  assert.deepEqual(out.recommendations.map((r) => r.requestId), ['A-2', 'A-1', 'A-3', 'A-4', 'A-5']);
  assert.match(out.summary, /2 con prioridad ALTA y 4 NORMAL/);
  assert.equal(validarSalida(JSON.stringify(out), ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6']).ok, true);
});
