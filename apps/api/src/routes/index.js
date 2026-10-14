'use strict';
const express = require('express');
const { autenticar, login, logout, me } = require('../middleware/auth');
const svc = require('../services/requests');
const ai = require('../services/ai');
const { HttpError } = require('../errors');

const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function rutas({ proveedorIA }) {
  const r = express.Router();

  // SPEC-1
  r.post('/auth/login', h(login));
  r.use(autenticar); // todo lo que sigue exige sesión (AC-RNF01-01)
  r.post('/auth/logout', h(logout));
  r.get('/auth/me', h(me));

  // SPEC-2
  r.post('/requests', h(async (req, res) => res.status(201).json(await svc.crear(req.user, req.body))));
  r.put('/requests/:id', h(async (req, res) => res.json(await svc.editar(req.user, req.params.id, req.body))));
  r.post('/requests/:id/submit', h(async (req, res) => res.json(await svc.enviar(req.user, req.params.id, req.body, req.correlationId))));
  r.post('/requests/:id/cancel', h(async (req, res) => res.json(await svc.transicionConInventario(req.user, req.params.id, 'cancelar', req.correlationId))));
  r.post('/requests/:id/deliver', h(async (req, res) => res.json(await svc.transicionConInventario(req.user, req.params.id, 'entregar', req.correlationId))));

  // SPEC-3
  r.post('/requests/:id/reserve', h(async (req, res) => {
    const out = await svc.reservar(req.user, req.params.id, req.get('Idempotency-Key'), req.body, req.correlationId);
    if (out.repetida) res.set('Idempotent-Replayed', 'true');
    res.status(out.status).json(out.body);
  }));
  r.post('/requests/:id/dispatch', h(async (req, res) => res.json(await svc.transicionConInventario(req.user, req.params.id, 'despachar', req.correlationId))));
  r.get('/inventory', h(async (req, res) => res.json(await svc.inventario(req.user, req.query))));

  // SPEC-4
  r.get('/requests', h(async (req, res) => res.json(await svc.listar(req.user, req.query))));
  r.get('/requests/:id', h(async (req, res) => res.json(await svc.obtener(req.user, req.params.id))));
  r.get('/catalog', h(async (req, res) => res.json(await svc.catalogo(req.user))));
  r.get('/dashboard', h(async (req, res) => res.json(await svc.dashboard(req.user))));
  r.get('/audit', h(async (req, res) => res.json(await svc.auditoria(req.user, req.query))));
  const inmutable = () => { throw new HttpError(405, 'METODO_NO_PERMITIDO', 'El historial de auditoría no se edita ni se borra'); };
  r.put('/audit/:id', h(inmutable));
  r.patch('/audit/:id', h(inmutable));
  r.delete('/audit/:id', h(inmutable));

  // SPEC-5
  r.post('/ai/summaries', h(async (req, res) => res.status(201).json(await ai.crearResumen(req.user, req.body, req.correlationId, proveedorIA()))));
  r.get('/ai/summaries/:id', h(async (req, res) => res.json(await ai.obtenerResumen(req.user, req.params.id))));
  r.post('/ai/summaries/:id/approve', h(async (req, res) => res.json(await ai.aprobar(req.user, req.params.id, req.correlationId))));

  return r;
}

module.exports = { rutas };
