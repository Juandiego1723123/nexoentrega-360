'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const db = require('./db');
const { correlation, log } = require('./middleware/correlation');
const { rutas } = require('./routes');
const { HttpError } = require('./errors');
const { proveedorPorDefecto } = require('./ai/providers');

/**
 * @param {{ proveedorIA?: () => {nombre: string, generar: Function} }} opciones
 *   proveedorIA permite a las pruebas inyectar un adaptador simulado (AC-RF10-01).
 */
function crearApp({ proveedorIA = proveedorPorDefecto } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(correlation);
  app.use(express.json({ limit: '100kb' }));

  // RNF06: health (proceso vivo) y readiness (base de datos accesible) diferenciados.
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/ready', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  app.use('/api', rutas({ proveedorIA }));
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NO_ENCONTRADO', message: 'Ruta no encontrada' } }));

  // Interfaz web compilada (apps/web/dist) servida desde el mismo origen.
  const dist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // Manejo uniforme de errores: nunca expone trazas, SQL ni datos de otra organización.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      const body = { error: { code: err.code, message: err.message } };
      if (err.field) body.error.field = err.field;
      return res.status(err.status).json(body);
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(422).json({ error: { code: 'VALIDACION', message: 'JSON mal formado', field: 'body' } });
    }
    log({ level: 'error', msg: 'error_no_controlado', correlationId: req.correlationId, error: err.message, sqlState: err.code });
    res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'Error interno', correlationId: req.correlationId } });
  });
  return app;
}

module.exports = { crearApp };
