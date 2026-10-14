'use strict';
// SPEC-5 · Asistente de IA (RF10, RF11, RF12, RNF06) · ADR-04
const db = require('../db');
const config = require('../config');
const { forbidden, notFound, conflict, invalid } = require('../errors');
const { validarSalida } = require('../ai/validator');
const { resumenDeterminista } = require('../ai/fallback');
const { audit } = require('./requests');
const { log } = require('../middleware/correlation');

const ETIQUETA = 'Asistencia de IA';

function conLimite(promesa, ms, controller) {
  let timer;
  const limite = new Promise((_, rej) => {
    timer = setTimeout(() => { controller.abort(); rej(Object.assign(new Error('TIMEOUT'), { timeout: true })); }, ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

function vista(row, aviso = null) {
  return {
    id: row.id,
    etiqueta: ETIQUETA,
    estado: row.estado,
    origen: row.origen,
    requestIds: row.request_ids,
    summary: row.summary,
    recommendations: row.recommendations,
    aviso,
    creadoEn: row.created_at.toISOString(),
    aprobadoEn: row.approved_at ? row.approved_at.toISOString() : null,
  };
}

async function crearResumen(user, body, correlationId, proveedor) {
  // Paso 1: solo el coordinador.
  if (user.rol !== 'COORDINADOR') throw forbidden('Solo el coordinador usa el asistente de IA');
  // Paso 2: validar requestIds ANTES de invocar el adaptador.
  const ids = body && body.requestIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20) throw invalid('requestIds', 'Seleccione entre 1 y 20 solicitudes');
  if (ids.some((x) => typeof x !== 'string')) throw invalid('requestIds', 'Identificadores inválidos');
  if (new Set(ids).size !== ids.length) throw invalid('requestIds', 'Hay identificadores repetidos');
  const { rows } = await db.query(
    `SELECT code, zona, prioridad, fecha_requerida, estado, observaciones FROM requests WHERE org_id = $1 AND code = ANY($2::text[])`,
    [user.orgId, ids]
  );
  if (rows.length !== ids.length) throw invalid('requestIds', 'Alguna solicitud no existe en su organización'); // mismo mensaje: no revela existencia ajena
  if (rows.some((r) => r.estado !== 'ENVIADA')) throw invalid('requestIds', 'Todas las solicitudes deben estar ENVIADA');

  // Paso 3: envío mínimo (sin contraseñas, sesiones, nombre del solicitante ni datos de otra organización).
  const minimas = ids.map((id) => {
    const r = rows.find((x) => x.code === id);
    return { requestId: r.code, zona: r.zona, prioridad: r.prioridad, fechaRequerida: r.fecha_requerida.toISOString(), estado: r.estado, observaciones: r.observaciones };
  });

  // Pasos 4-6: invocar con límite, validar, degradar.
  let origen = 'IA';
  let motivo = null;
  let salida;
  const controller = new AbortController();
  try {
    const raw = await conLimite(proveedor.generar(minimas, { signal: controller.signal }), config.aiTimeoutMs, controller);
    const v = validarSalida(raw, ids);
    if (v.ok) salida = v.data; else motivo = v.motivo;
  } catch (e) {
    motivo = e.timeout ? 'TIMEOUT' : (e.message || 'ERROR_PROVEEDOR');
  }
  if (!salida) {
    origen = 'DETERMINISTA';
    salida = resumenDeterminista(minimas);
    log({ level: 'warn', msg: 'ia_degradada', correlationId, proveedor: proveedor.nombre, motivo });
  }

  // Paso 7: guardar el borrador con su origen y el motivo del fallo (nunca el texto enviado al modelo).
  const ins = await db.query(
    `INSERT INTO ai_summaries (org_id, coordinator_id, request_ids, origen, motivo_fallo, summary, recommendations)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [user.orgId, user.id, ids, origen, motivo, salida.summary, JSON.stringify(salida.recommendations)]
  );
  const aviso = origen === 'IA' ? null
    : motivo === 'SIN_PROVEEDOR'
      ? 'Asistente sin proveedor de IA configurado: se muestra un resumen determinista.'
      : 'El asistente de IA no respondió de forma válida a tiempo: se muestra un resumen determinista.';
  return vista(ins.rows[0], aviso);
}

async function cargar(c, user, id) {
  if (!/^\d+$/.test(String(id))) throw notFound('Resumen no encontrado');
  const { rows } = await c.query('SELECT * FROM ai_summaries WHERE id = $1 AND org_id = $2 FOR UPDATE', [Number(id), user.orgId]);
  if (!rows[0]) throw notFound('Resumen no encontrado');
  return rows[0];
}

async function obtenerResumen(user, id) {
  if (user.rol !== 'COORDINADOR') throw forbidden('Solo el coordinador consulta resúmenes de IA');
  return db.withTransaction(async (c) => vista(await cargar(c, user, id)));
}

// Paso 8: aprobar es una decisión humana; no reserva, despacha ni cambia prioridades.
async function aprobar(user, id, correlationId) {
  return db.withTransaction(async (c) => {
    const row = await cargar(c, user, id);
    if (user.rol !== 'COORDINADOR') throw forbidden('Solo el coordinador aprueba resúmenes');
    if (row.estado === 'APROBADO') throw conflict('YA_APROBADO', 'El resumen ya fue aprobado');
    const { rows } = await c.query(
      `UPDATE ai_summaries SET estado = 'APROBADO', approved_at = now(), approved_by = $2 WHERE id = $1 RETURNING *`, [row.id, user.id]
    );
    await audit(c, user, 'resumen_ia', String(row.id), 'APROBAR_RESUMEN', correlationId);
    return vista(rows[0]);
  });
}

module.exports = { crearResumen, aprobar, obtenerResumen, ETIQUETA };
