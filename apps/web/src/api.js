// Cliente HTTP: la sesión viaja en una cookie HttpOnly; el navegador nunca ve el token.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Error ${status}`);
    this.status = status;
    this.code = body?.error?.code;
    this.field = body?.error?.field;
  }
}

export async function api(method, path, { body, headers } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const ESTADOS = ['BORRADOR', 'ENVIADA', 'RESERVADA', 'DESPACHADA', 'ENTREGADA', 'CANCELADA'];
export const ZONAS = ['NORTE', 'SUR', 'CENTRO', 'ORIENTE', 'OCCIDENTE'];
export const ROLES = { SOLICITANTE: 'Solicitante', COORDINADOR: 'Coordinador', BODEGA: 'Bodega', AUDITOR: 'Auditor' };
export const fechaCorta = (iso) => new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
