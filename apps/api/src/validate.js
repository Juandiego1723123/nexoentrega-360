'use strict';
// Validación de entrada de SPEC-2 (RF03) y SPEC-4 (RF08). Devuelve el primer error con su campo.
const { invalid } = require('./errors');

const ZONAS = ['NORTE', 'SUR', 'CENTRO', 'ORIENTE', 'OCCIDENTE']; // supuesto 1 (sección 3.1)
const PRIORIDADES = ['NORMAL', 'ALTA'];
const ESTADOS = ['BORRADOR', 'ENVIADA', 'RESERVADA', 'DESPACHADA', 'ENTREGADA', 'CANCELADA'];
const MAX_LINEAS = 10;
const MAX_CANTIDAD = 500;
const MAX_OBS = 500; // supuesto 3

const esFechaIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v));

// Valida el cuerpo de una solicitud. `ahora` permite exigir fecha no anterior al envío.
function validarSolicitud(body, { ahora = null } = {}) {
  if (!body || typeof body !== 'object') throw invalid('body', 'Cuerpo inválido');
  const { zona, prioridad, fechaRequerida, observaciones, lineas } = body;
  if (!ZONAS.includes(zona)) throw invalid('zona', `Zona inválida. Use: ${ZONAS.join(', ')}`);
  if (!PRIORIDADES.includes(prioridad)) throw invalid('prioridad', 'Prioridad debe ser NORMAL o ALTA');
  if (!esFechaIso(fechaRequerida)) throw invalid('fechaRequerida', 'Fecha requerida en formato ISO 8601');
  if (ahora && Date.parse(fechaRequerida) < ahora.getTime()) {
    throw invalid('fechaRequerida', 'La fecha requerida no puede ser anterior al momento del envío');
  }
  if (observaciones !== undefined && observaciones !== null) {
    if (typeof observaciones !== 'string' || observaciones.length > MAX_OBS) {
      throw invalid('observaciones', `Observaciones: texto de máximo ${MAX_OBS} caracteres`);
    }
  }
  if (!Array.isArray(lineas) || lineas.length < 1 || lineas.length > MAX_LINEAS) {
    throw invalid('lineas', `La solicitud debe tener entre 1 y ${MAX_LINEAS} líneas`);
  }
  const vistos = new Set();
  lineas.forEach((l, i) => {
    if (!l || typeof l.sku !== 'string' || !l.sku.trim()) throw invalid(`lineas[${i}].sku`, 'SKU obligatorio');
    if (vistos.has(l.sku)) throw invalid(`lineas[${i}].sku`, `SKU repetido: ${l.sku}`);
    vistos.add(l.sku);
    if (!Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > MAX_CANTIDAD) {
      throw invalid(`lineas[${i}].cantidad`, `La cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD}`);
    }
  });
  return {
    zona, prioridad, fechaRequerida,
    observaciones: observaciones ?? null,
    lineas: lineas.map((l) => ({ sku: l.sku, cantidad: l.cantidad })),
  };
}

function entero(valor, campo, { min, max, defecto }) {
  if (valor === undefined) return defecto;
  if (!/^\d+$/.test(String(valor))) throw invalid(campo, `${campo} debe ser un entero`);
  const n = Number(valor);
  if (n < min || n > max) throw invalid(campo, `${campo} debe estar entre ${min} y ${max}`);
  return n;
}

function validarPaginacion(q) {
  return {
    page: entero(q.page, 'page', { min: 1, max: 1e6, defecto: 1 }),
    pageSize: entero(q.pageSize, 'pageSize', { min: 1, max: 100, defecto: 20 }),
  };
}

function validarFiltros(q) {
  const f = {};
  if (q.estado !== undefined) { if (!ESTADOS.includes(q.estado)) throw invalid('estado', 'Estado inválido'); f.estado = q.estado; }
  if (q.prioridad !== undefined) { if (!PRIORIDADES.includes(q.prioridad)) throw invalid('prioridad', 'Prioridad inválida'); f.prioridad = q.prioridad; }
  if (q.zona !== undefined) { if (!ZONAS.includes(q.zona)) throw invalid('zona', 'Zona desconocida'); f.zona = q.zona; }
  return f;
}

function validarRangoFechas(q) {
  const r = {};
  if (q.desde !== undefined) { if (!esFechaIso(q.desde)) throw invalid('desde', 'desde debe ser fecha ISO 8601 UTC'); r.desde = q.desde; }
  if (q.hasta !== undefined) { if (!esFechaIso(q.hasta)) throw invalid('hasta', 'hasta debe ser fecha ISO 8601 UTC'); r.hasta = q.hasta; }
  if (r.desde && r.hasta && Date.parse(r.desde) > Date.parse(r.hasta)) throw invalid('desde', 'desde debe ser menor o igual que hasta');
  return r;
}

module.exports = { ZONAS, PRIORIDADES, ESTADOS, validarSolicitud, validarPaginacion, validarFiltros, validarRangoFechas, esFechaIso };
