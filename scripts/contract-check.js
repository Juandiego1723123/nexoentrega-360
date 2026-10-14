'use strict';
// Verifica que las operaciones de contracts/openapi.yaml coinciden exactamente con las rutas de Express.
// Sin dependencias: lee los bloques "paths" del YAML por indentación.
const fs = require('node:fs');
const path = require('node:path');

process.env.LOG_SILENT = 'true';
const { crearApp } = require('../apps/api/src/app');

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

function delContrato() {
  const yaml = fs.readFileSync(path.resolve(__dirname, '../contracts/openapi.yaml'), 'utf8').split('\n');
  const ops = new Set();
  let enPaths = false;
  let actual = null;
  for (const l of yaml) {
    if (/^paths:\s*$/.test(l)) { enPaths = true; continue; }
    if (!enPaths) continue;
    if (/^\S/.test(l)) break;
    const p = l.match(/^ {2}(\/\S*):\s*$/);
    if (p) { actual = p[1].replace(/\{(\w+)\}/g, ':$1'); continue; }
    const m = l.match(/^ {4}(get|post|put|patch|delete):/);
    if (m && actual) ops.add(`${m[1].toUpperCase()} /api${actual}`);
  }
  return ops;
}

function deExpress() {
  const ops = new Set();
  const visitar = (pila, prefijo) => {
    for (const capa of pila) {
      if (capa.route) {
        for (const m of Object.keys(capa.route.methods)) if (METODOS.includes(m)) ops.add(`${m.toUpperCase()} ${prefijo}${capa.route.path}`);
      } else if (capa.name === 'router' && capa.handle.stack) {
        visitar(capa.handle.stack, prefijo || '/api');
      }
    }
  };
  visitar(crearApp()._router.stack, '');
  ops.delete('GET *'); // interfaz web (SPA), fuera del contrato de la API
  return ops;
}

const contrato = delContrato();
const codigo = deExpress();
const faltan = [...contrato].filter((o) => !codigo.has(o));
const sobran = [...codigo].filter((o) => !contrato.has(o));
if (faltan.length || sobran.length) {
  if (faltan.length) console.error('En el contrato pero no implementadas:\n  ' + faltan.join('\n  '));
  if (sobran.length) console.error('Implementadas pero no documentadas:\n  ' + sobran.join('\n  '));
  process.exit(1);
}
console.log(`OK: las ${contrato.size} operaciones del contrato coinciden con las rutas implementadas`);
process.exit(0);
