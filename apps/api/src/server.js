'use strict';
const config = require('./config');
const { crearApp } = require('./app');
const { log } = require('./middleware/correlation');

crearApp().listen(config.port, () => {
  log({ level: 'info', msg: 'servidor_iniciado', port: config.port, aiProvider: config.aiProvider });
});
