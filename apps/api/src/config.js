'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Carga .env sin dependencias externas (solo si existe; las variables del entorno tienen prioridad).
const envFile = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envFile)) {
  for (const linea of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL || 'postgres://nexo:nexo_demo@localhost:5432/nexoentrega',
  seedPassword: process.env.SEED_PASSWORD || 'NexoDemo2026!',
  aiProvider: process.env.AI_PROVIDER || 'none',
  aiFixture: process.env.AI_FIXTURE || 'AI-VALID',
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS) || 5000,
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  sessionHours: 8,
};
