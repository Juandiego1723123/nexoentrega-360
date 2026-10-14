'use strict';
// Verifica que cada criterio AC de specs/*/spec.json tenga al menos una prueba con su ID (y que no haya pruebas huérfanas).
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const leer = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? leer(path.join(dir, e.name)) : [path.join(dir, e.name)]);

const criterios = leer(path.join(raiz, 'specs')).filter((f) => f.endsWith('spec.json'))
  .flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')).acceptanceCriteria.map((a) => a.id));
const pruebas = leer(path.join(raiz, 'tests')).filter((f) => /\.(js)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const enPruebas = new Set(pruebas.match(/AC-R[N]?F\d{2}-\d{2}b?/g));

const sinPrueba = criterios.filter((id) => !enPruebas.has(id));
const huerfanas = [...enPruebas].filter((id) => !criterios.includes(id));
if (sinPrueba.length || huerfanas.length) {
  if (sinPrueba.length) console.error('Criterios sin prueba: ' + sinPrueba.join(', '));
  if (huerfanas.length) console.error('Pruebas con ID que no está en ninguna SPEC: ' + huerfanas.join(', '));
  process.exit(1);
}
console.log(`OK: ${criterios.length} criterios de aceptación, todos con prueba`);
