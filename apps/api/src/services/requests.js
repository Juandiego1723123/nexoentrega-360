'use strict';
// SPEC-2 (solicitudes), SPEC-3 (inventario y transiciones), SPEC-4 (consultas y auditoría) · ADR-02
const crypto = require('node:crypto');
const db = require('../db');
const { HttpError, forbidden, notFound, conflict, invalid } = require('../errors');
const { validarSolicitud, validarPaginacion, validarFiltros, validarRangoFechas, ESTADOS } = require('../validate');

// RF04: única tabla de transiciones permitidas. Cualquier otra responde 409.
const TRANSITIONS = Object.freeze({
  enviar: { desde: ['BORRADOR'], hacia: 'ENVIADA', rol: 'SOLICITANTE', accion: 'ENVIAR' },
  reservar: { desde: ['ENVIADA'], hacia: 'RESERVADA', rol: 'COORDINADOR', accion: 'RESERVAR' },
  despachar: { desde: ['RESERVADA'], hacia: 'DESPACHADA', rol: 'BODEGA', accion: 'DESPACHAR' },
  entregar: { desde: ['DESPACHADA'], hacia: 'ENTREGADA', rol: 'COORDINADOR', accion: 'ENTREGAR' },
  cancelar: { desde: ['ENVIADA', 'RESERVADA'], hacia: 'CANCELADA', rol: 'SOLICITANTE', accion: 'CANCELAR' },
});

// ---------------------------------------------------------------- utilidades
async function audit(client, user, recurso, recursoId, accion, correlationId) {
  await client.query(
    `INSERT INTO audit_events (actor_id, organization_id, recurso, recurso_id, accion, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.id, user.orgId, recurso, recursoId, accion, correlationId]
  );
}

// RF02: un recurso inexistente o de otra organización responde 404 (no revela existencia).
async function loadForUser(client, user, code, { forUpdate = false } = {}) {
  if (typeof code !== 'string' || !/^[A-Z]-\d{3,6}$/.test(code)) throw notFound('Solicitud no encontrada');
  const { rows } = await client.query(
    `SELECT * FROM requests WHERE code = $1 AND org_id = $2 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [code, user.orgId]
  );
  if (!rows[0]) throw notFound('Solicitud no encontrada');
  return rows[0];
}

// Supuesto 8: un solicitante solo opera y consulta sus propias solicitudes (403 dentro de su organización).
function exigirDueno(user, req) {
  if (user.rol === 'SOLICITANTE' && req.requester_id !== user.id) throw forbidden('Solo el solicitante dueño puede operar esta solicitud');
}

function exigirTransicion(t, req) {
  if (!t.desde.includes(req.estado)) {
    throw conflict('TRANSICION_INVALIDA', `No se puede pasar de ${req.estado} a ${t.hacia}`);
  }
}

async function resolverProductos(client, orgId, lineas) {
  const skus = lineas.map((l) => l.sku);
  const { rows } = await client.query(
    'SELECT id, sku, active FROM products WHERE org_id = $1 AND sku = ANY($2::text[])', [orgId, skus]
  );
  const porSku = new Map(rows.map((r) => [r.sku, r]));
  return lineas.map((l, i) => {
    const p = porSku.get(l.sku);
    if (!p || !p.active) throw invalid(`lineas[${i}].sku`, `SKU inexistente o inactivo en su organización: ${l.sku}`);
    return { productId: p.id, sku: l.sku, cantidad: l.cantidad };
  });
}

async function detalle(client, code) {
  const { rows } = await client.query(
    `SELECT r.*, u.name AS solicitante_nombre FROM requests r JOIN users u ON u.id = r.requester_id WHERE r.code = $1`, [code]
  );
  const r = rows[0];
  const lineas = await client.query(
    `SELECT p.sku, p.name, l.cantidad FROM request_lines l JOIN products p ON p.id = l.product_id
      WHERE l.request_code = $1 ORDER BY p.sku`, [code]
  );
  return {
    codigo: r.code,
    organizacion: r.org_id,
    solicitante: { id: r.requester_id, nombre: r.solicitante_nombre },
    zona: r.zona,
    prioridad: r.prioridad,
    fechaRequerida: r.fecha_requerida.toISOString(),
    observaciones: r.observaciones,
    estado: r.estado,
    creadoEn: r.created_at.toISOString(),
    actualizadoEn: r.updated_at.toISOString(),
    lineas: lineas.rows.map((l) => ({ sku: l.sku, nombre: l.name, cantidad: l.cantidad })),
  };
}

async function inventarioDe(client, code) {
  const { rows } = await client.query(
    `SELECT p.sku, i.on_hand, i.reserved FROM request_lines l
       JOIN inventory i ON i.product_id = l.product_id JOIN products p ON p.id = l.product_id
      WHERE l.request_code = $1 ORDER BY p.sku`, [code]
  );
  return rows.map((r) => ({ sku: r.sku, existenciaFisica: r.on_hand, reservada: r.reserved, disponible: r.on_hand - r.reserved }));
}

// Bloquea las filas de inventario de la solicitud en orden de producto (evita bloqueos cruzados).
async function bloquearInventario(client, code) {
  const { rows } = await client.query(
    `SELECT l.product_id, l.cantidad, i.on_hand, i.reserved, p.sku
       FROM request_lines l
       JOIN inventory i ON i.product_id = l.product_id
       JOIN products p ON p.id = l.product_id
      WHERE l.request_code = $1
      ORDER BY l.product_id
      FOR UPDATE OF i`, [code]
  );
  return rows;
}

// ---------------------------------------------------------------- SPEC-2
async function crear(user, body) {
  if (user.rol !== 'SOLICITANTE') throw forbidden('Solo el solicitante crea solicitudes');
  const datos = validarSolicitud(body);
  return db.withTransaction(async (c) => {
    const lineas = await resolverProductos(c, user.orgId, datos.lineas);
    const org = await c.query(
      `UPDATE organizations SET next_request_number = next_request_number + 1 WHERE id = $1
       RETURNING code_prefix, next_request_number - 1 AS numero`, [user.orgId]
    );
    const code = `${org.rows[0].code_prefix}-${String(org.rows[0].numero).padStart(3, '0')}`;
    await c.query(
      `INSERT INTO requests (code, org_id, requester_id, zona, prioridad, fecha_requerida, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [code, user.orgId, user.id, datos.zona, datos.prioridad, datos.fechaRequerida, datos.observaciones]
    );
    for (const l of lineas) {
      await c.query('INSERT INTO request_lines (request_code, product_id, cantidad) VALUES ($1, $2, $3)', [code, l.productId, l.cantidad]);
    }
    return detalle(c, code);
  });
}

async function reemplazarContenido(c, code, user, datos) {
  const lineas = await resolverProductos(c, user.orgId, datos.lineas);
  await c.query(
    `UPDATE requests SET zona = $2, prioridad = $3, fecha_requerida = $4, observaciones = $5, updated_at = now() WHERE code = $1`,
    [code, datos.zona, datos.prioridad, datos.fechaRequerida, datos.observaciones]
  );
  await c.query('DELETE FROM request_lines WHERE request_code = $1', [code]);
  for (const l of lineas) {
    await c.query('INSERT INTO request_lines (request_code, product_id, cantidad) VALUES ($1, $2, $3)', [code, l.productId, l.cantidad]);
  }
}

async function editar(user, code, body) {
  return db.withTransaction(async (c) => {
    const r = await loadForUser(c, user, code, { forUpdate: true });
    if (user.rol !== 'SOLICITANTE') throw forbidden('Solo el solicitante dueño edita su borrador');
    exigirDueno(user, r);
    if (r.estado !== 'BORRADOR') throw conflict('NO_EDITABLE', 'Solo el borrador es editable');
    const datos = validarSolicitud(body);
    await reemplazarContenido(c, code, user, datos);
    return detalle(c, code);
  });
}

// Enviar revalida todo contra el momento del envío. Puede recibir el contenido final del formulario.
async function enviar(user, code, body, correlationId, ahora = new Date()) {
  const t = TRANSITIONS.enviar;
  return db.withTransaction(async (c) => {
    const r = await loadForUser(c, user, code, { forUpdate: true });
    if (user.rol !== t.rol) throw forbidden('Solo el solicitante dueño envía su solicitud');
    exigirDueno(user, r);
    exigirTransicion(t, r);
    const tieneContenido = body && typeof body === 'object' && Object.keys(body).length > 0;
    if (tieneContenido) {
      const datos = validarSolicitud(body, { ahora });
      await reemplazarContenido(c, code, user, datos);
    } else {
      const actual = await detalle(c, code);
      validarSolicitud({ ...actual, lineas: actual.lineas.map((l) => ({ sku: l.sku, cantidad: l.cantidad })) }, { ahora });
      await resolverProductos(c, user.orgId, actual.lineas);
    }
    await c.query(`UPDATE requests SET estado = 'ENVIADA', submitted_at = now(), updated_at = now() WHERE code = $1`, [code]);
    await audit(c, user, 'solicitud', code, t.accion, correlationId);
    return detalle(c, code);
  });
}

// ---------------------------------------------------------------- SPEC-3
const hashContenido = (op, code, body) =>
  crypto.createHash('sha256').update(JSON.stringify({ op, code, body: body || {} })).digest('hex');

async function reservar(user, code, idemKey, body, correlationId) {
  const t = TRANSITIONS.reservar;
  // 1. Autorizar antes de tocar la idempotencia (RF07).
  const previo = await loadForUser(db, user, code);
  if (user.rol !== t.rol) throw forbidden('Solo el coordinador reserva solicitudes');
  void previo;
  if (typeof idemKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idemKey)) {
    throw invalid('Idempotency-Key', 'Encabezado Idempotency-Key obligatorio con formato UUID');
  }
  const hash = hashContenido('reserve', code, body);

  return db.withTransaction(async (c) => {
    // 2. Registrar la clave; si ya existe, esperar a que su transacción termine y repetir su resultado.
    await c.query(`DELETE FROM idempotency_keys WHERE idem_key = $1 AND user_id = $2 AND operation = 'reserve' AND expires_at < now()`, [idemKey, user.id]);
    const ins = await c.query(
      `INSERT INTO idempotency_keys (idem_key, user_id, operation, request_hash) VALUES ($1, $2, 'reserve', $3)
       ON CONFLICT DO NOTHING RETURNING idem_key`, [idemKey, user.id, hash]
    );
    if (ins.rowCount === 0) {
      const { rows } = await c.query(
        `SELECT request_hash, status_code, response_body FROM idempotency_keys WHERE idem_key = $1 AND user_id = $2 AND operation = 'reserve'`,
        [idemKey, user.id]
      );
      if (rows[0].request_hash !== hash) throw conflict('IDEMPOTENCIA_CONFLICTO', 'La misma Idempotency-Key se usó con otro contenido');
      return { status: rows[0].status_code, body: rows[0].response_body, repetida: true };
    }
    const guardar = async (status, respuesta) => {
      await c.query(
        `UPDATE idempotency_keys SET status_code = $4, response_body = $5 WHERE idem_key = $1 AND user_id = $2 AND operation = $3`,
        [idemKey, user.id, 'reserve', status, JSON.stringify(respuesta)]
      );
      return { status, body: respuesta };
    };

    // 3. Bloquear la solicitud; debe seguir ENVIADA.
    const r = await loadForUser(c, user, code, { forUpdate: true });
    if (!t.desde.includes(r.estado)) {
      return guardar(409, { error: { code: 'TRANSICION_INVALIDA', message: `No se puede reservar una solicitud ${r.estado}` } });
    }
    // 4-5. Bloquear inventario en orden de producto y verificar TODAS las líneas.
    const filas = await bloquearInventario(c, code);
    const faltantes = filas.filter((f) => f.on_hand - f.reserved < f.cantidad);
    if (faltantes.length) {
      return guardar(409, {
        error: {
          code: 'STOCK_INSUFICIENTE',
          message: 'No hay disponibilidad para todas las líneas; no se reservó nada',
          detalle: faltantes.map((f) => ({ sku: f.sku, solicitada: f.cantidad, disponible: f.on_hand - f.reserved })),
        },
      });
    }
    // 6. Reservar, cambiar estado, auditar y guardar el resultado en la misma transacción.
    for (const f of filas) {
      await c.query('UPDATE inventory SET reserved = reserved + $2 WHERE product_id = $1', [f.product_id, f.cantidad]);
    }
    await c.query(`UPDATE requests SET estado = 'RESERVADA', updated_at = now() WHERE code = $1`, [code]);
    await audit(c, user, 'solicitud', code, t.accion, correlationId);
    const respuesta = { ...(await detalle(c, code)), inventario: await inventarioDe(c, code) };
    return guardar(200, respuesta);
  });
}

async function transicionConInventario(user, code, nombre, correlationId) {
  const t = TRANSITIONS[nombre];
  return db.withTransaction(async (c) => {
    const r = await loadForUser(c, user, code, { forUpdate: true });
    if (user.rol !== t.rol) throw forbidden();
    exigirDueno(user, r);
    exigirTransicion(t, r);
    if (nombre === 'despachar') {
      const filas = await bloquearInventario(c, code);
      for (const f of filas) {
        await c.query('UPDATE inventory SET on_hand = on_hand - $2, reserved = reserved - $2 WHERE product_id = $1', [f.product_id, f.cantidad]);
      }
    } else if (nombre === 'cancelar' && r.estado === 'RESERVADA') {
      const filas = await bloquearInventario(c, code);
      for (const f of filas) {
        await c.query('UPDATE inventory SET reserved = reserved - $2 WHERE product_id = $1', [f.product_id, f.cantidad]);
      }
    } // entregar y cancelar una ENVIADA no tocan inventario (RF06)
    await c.query('UPDATE requests SET estado = $2, updated_at = now() WHERE code = $1', [code, t.hacia]);
    await audit(c, user, 'solicitud', code, t.accion, correlationId);
    return { ...(await detalle(c, code)), inventario: await inventarioDe(c, code) };
  });
}

// ---------------------------------------------------------------- SPEC-4
async function obtener(user, code) {
  const r = await loadForUser(db, user, code);
  exigirDueno(user, r);
  const c = await db.pool.connect();
  try { return await detalle(c, code); } finally { c.release(); }
}

function alcance(user, params) {
  const where = ['r.org_id = $1'];
  params.push(user.orgId);
  if (user.rol === 'SOLICITANTE') { params.push(user.id); where.push(`r.requester_id = $${params.length}`); }
  return where;
}

async function listar(user, query) {
  const { page, pageSize } = validarPaginacion(query);
  const filtros = validarFiltros(query);
  const params = [];
  const where = alcance(user, params);
  for (const [campo, valor] of Object.entries(filtros)) { params.push(valor); where.push(`r.${campo} = $${params.length}`); }
  const w = where.join(' AND ');
  const total = await db.query(`SELECT count(*)::int AS n FROM requests r WHERE ${w}`, params);
  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await db.query(
    `SELECT r.code, r.zona, r.prioridad, r.fecha_requerida, r.estado, r.created_at, r.requester_id,
            (SELECT count(*)::int FROM request_lines l WHERE l.request_code = r.code) AS lineas
       FROM requests r WHERE ${w}
      ORDER BY r.created_at DESC, r.code DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  return {
    items: rows.map((r) => ({
      codigo: r.code, zona: r.zona, prioridad: r.prioridad, fechaRequerida: r.fecha_requerida.toISOString(),
      estado: r.estado, creadoEn: r.created_at.toISOString(), lineas: r.lineas,
    })),
    page, pageSize, total: total.rows[0].n,
  };
}

async function dashboard(user) {
  const params = [];
  const where = alcance(user, params);
  const { rows } = await db.query(`SELECT r.estado, count(*)::int AS n FROM requests r WHERE ${where.join(' AND ')} GROUP BY r.estado`, params);
  const conteos = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  for (const r of rows) conteos[r.estado] = r.n;
  return { organizacion: user.orgId, conteos };
}

async function inventario(user, query) {
  if (user.rol === 'SOLICITANTE') throw forbidden('El solicitante no consulta inventario');
  const { page, pageSize } = validarPaginacion(query);
  const total = await db.query('SELECT count(*)::int AS n FROM products WHERE org_id = $1', [user.orgId]);
  const { rows } = await db.query(
    `SELECT p.sku, p.name, p.active, i.on_hand, i.reserved FROM products p JOIN inventory i ON i.product_id = p.id
      WHERE p.org_id = $1 ORDER BY p.sku LIMIT $2 OFFSET $3`, [user.orgId, pageSize, (page - 1) * pageSize]
  );
  return {
    items: rows.map((r) => ({ sku: r.sku, nombre: r.name, activo: r.active, existenciaFisica: r.on_hand, reservada: r.reserved, disponible: r.on_hand - r.reserved })),
    page, pageSize, total: total.rows[0].n,
  };
}

async function catalogo(user) {
  const { rows } = await db.query('SELECT sku, name FROM products WHERE org_id = $1 AND active ORDER BY sku', [user.orgId]);
  return { items: rows.map((r) => ({ sku: r.sku, nombre: r.name })) };
}

async function auditoria(user, query) {
  if (user.rol !== 'AUDITOR') throw forbidden('Solo el auditor consulta la auditoría');
  const { page, pageSize } = validarPaginacion(query);
  const rango = validarRangoFechas(query);
  const params = [user.orgId];
  const where = ['organization_id = $1'];
  if (rango.desde) { params.push(rango.desde); where.push(`fecha_utc >= $${params.length}`); }
  if (rango.hasta) { params.push(rango.hasta); where.push(`fecha_utc <= $${params.length}`); }
  const w = where.join(' AND ');
  const total = await db.query(`SELECT count(*)::int AS n FROM audit_events WHERE ${w}`, params);
  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await db.query(
    `SELECT * FROM audit_events WHERE ${w} ORDER BY fecha_utc DESC, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  return {
    items: rows.map((e) => ({
      id: Number(e.id), actorId: e.actor_id, organizacionId: e.organization_id, recurso: e.recurso,
      recursoId: e.recurso_id, accion: e.accion, fechaUtc: e.fecha_utc.toISOString(), correlationId: e.correlation_id,
    })),
    page, pageSize, total: total.rows[0].n,
  };
}

module.exports = {
  TRANSITIONS, audit, loadForUser, crear, editar, enviar, reservar, transicionConInventario,
  obtener, listar, dashboard, inventario, catalogo, auditoria, HttpError,
};
