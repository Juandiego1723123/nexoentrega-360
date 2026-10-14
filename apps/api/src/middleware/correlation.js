'use strict';
const crypto = require('node:crypto');

// RNF06: cada petición lleva un correlationId y deja un log JSON sin secretos.
function log(entry) {
  if (process.env.LOG_SILENT === 'true') return;
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

function correlation(req, res, next) {
  const recibido = req.get('X-Correlation-Id');
  req.correlationId = recibido && /^[A-Za-z0-9-]{8,64}$/.test(recibido) ? recibido : crypto.randomUUID();
  res.set('X-Correlation-Id', req.correlationId);
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    log({
      level: res.statusCode >= 500 ? 'error' : 'info',
      msg: 'http',
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,                 // sin query string ni cuerpo: nunca se registran credenciales
      status: res.statusCode,
      ms: Number(process.hrtime.bigint() - inicio) / 1e6,
      userId: req.user ? req.user.id : null,
      orgId: req.user ? req.user.orgId : null,
    });
  });
  next();
}

module.exports = { correlation, log };
