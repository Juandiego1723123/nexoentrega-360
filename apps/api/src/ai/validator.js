'use strict';
// RF11 · validación de la salida de IA: esquema estricto (anexo ai-output.schema.json) + reglas semánticas en código.
const Ajv2020 = require('ajv/dist/2020');
const schema = require('./schema.json');

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validarEsquema = ajv.compile(schema);

const PATRON_ACTIVO = /<\s*\/?\s*(script|iframe|img|svg|object|embed|style|link)\b|javascript:|on\w+\s*=/i;

/**
 * @param {string} raw  texto devuelto por el proveedor (no confiable)
 * @param {string[]} enviados  IDs que se enviaron al modelo
 * @returns {{ok: true, data: object} | {ok: false, motivo: string}}
 */
function validarSalida(raw, enviados) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, motivo: 'JSON_INVALIDO' };
  }
  if (!validarEsquema(data)) {
    const e = validarEsquema.errors[0];
    return { ok: false, motivo: `ESQUEMA: ${e.instancePath || '/'} ${e.message}` };
  }
  const permitidos = new Set(enviados);
  const vistos = new Set();
  for (const r of data.recommendations) {
    if (!permitidos.has(r.requestId)) return { ok: false, motivo: `ID_AJENO: ${r.requestId}` };
    if (vistos.has(r.requestId)) return { ok: false, motivo: `ID_DUPLICADO: ${r.requestId}` };
    vistos.add(r.requestId);
  }
  const textos = [data.summary, ...data.recommendations.map((r) => r.reason)];
  if (textos.some((t) => PATRON_ACTIVO.test(t))) return { ok: false, motivo: 'CONTENIDO_ACTIVO' };
  return { ok: true, data };
}

module.exports = { validarSalida };
