'use strict';
// SPEC-1 · Identidad y permisos (RF01, RF02, RNF01) · ADR-03
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { unauthorized, forbidden, invalid, HttpError } = require('../errors');

const COOKIE = 'nexo_sid';
// Hash ficticio para comparar en tiempo similar cuando el correo no existe.
const HASH_FICTICIO = bcrypt.hashSync('contrasena-ficticia-no-valida', 10);
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');

function leerCookie(req) {
  const raw = req.headers.cookie || '';
  for (const parte of raw.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

// Paso 3-4 de SPEC-1: el rol y la organización salen SIEMPRE de la sesión.
async function autenticar(req, res, next) {
  try {
    const token = leerCookie(req);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw unauthorized();
    const { rows } = await db.query(
      `SELECT u.id, u.org_id, u.email, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)]
    );
    if (!rows[0]) throw unauthorized();
    const u = rows[0];
    req.user = { id: u.id, orgId: u.org_id, email: u.email, nombre: u.name, rol: u.role };
    req.sessionTokenHash = sha256(token);
    next();
  } catch (e) {
    next(e);
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.rol) ? next() : next(forbidden());

async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw invalid('email', 'Ingrese un correo válido (máximo 120 caracteres)');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw invalid('password', 'La contraseña debe tener entre 8 y 72 caracteres');
  }
  const { rows } = await db.query('SELECT id, org_id, name, role, password_hash FROM users WHERE email = $1', [email.toLowerCase()]);
  const u = rows[0];
  // Mismo 401 y mismo mensaje para correo inexistente o contraseña errada (no revela si el correo existe).
  const ok = u ? await bcrypt.compare(password, u.password_hash) : await bcrypt.compare(password, HASH_FICTICIO);
  if (!u || !ok) throw new HttpError(401, 'CREDENCIALES', 'Correo o contraseña incorrectos');
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [sha256(token), u.id, config.sessionHours]
  );
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', maxAge: config.sessionHours * 3600 * 1000 });
  res.json({ id: u.id, nombre: u.name, rol: u.role, organizacion: u.org_id });
}

async function logout(req, res) {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [req.sessionTokenHash]);
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
}

function me(req, res) {
  res.json({ id: req.user.id, nombre: req.user.nombre, rol: req.user.rol, organizacion: req.user.orgId, email: req.user.email });
}

module.exports = { autenticar, requireRole, login, logout, me, COOKIE, sha256 };
