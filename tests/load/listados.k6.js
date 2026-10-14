// AC-RNF03-01 (RNF03): listados y tablero con 2.000 solicitudes sembradas, 20 VU durante 60 s tras 5 s de calentamiento. Excluye IA.
// Ejecución: npm run seed && npm run seed:load && k6 run tests/load/listados.k6.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const PASSWORD = __ENV.SEED_PASSWORD || 'NexoDemo2026!';

export const options = {
  scenarios: {
    calentamiento: { executor: 'constant-vus', vus: 20, duration: '5s', tags: { fase: 'calentamiento' } },
    medicion: { executor: 'constant-vus', vus: 20, duration: '60s', startTime: '5s', tags: { fase: 'medicion' } },
  },
  thresholds: {
    'http_req_duration{fase:medicion}': ['p(95)<=700'],
    'http_req_failed{fase:medicion}': ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  const r = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: 'org-a-coordinador@example.test', password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'login 200': (x) => x.status === 200 });
  return { cookie: `nexo_sid=${r.cookies.nexo_sid[0].value}` };
}

const CONSULTAS = [
  '/api/requests?pageSize=20',
  '/api/requests?pageSize=100&page=3',
  '/api/requests?estado=ENVIADA&pageSize=50',
  '/api/requests?prioridad=ALTA&zona=NORTE',
  '/api/dashboard',
];

export default function (data) {
  const ruta = CONSULTAS[Math.floor(Math.random() * CONSULTAS.length)];
  const r = http.get(`${BASE}${ruta}`, { headers: { Cookie: data.cookie }, tags: { ruta: ruta.split('?')[0] } });
  check(r, { 'status 200': (x) => x.status === 200 });
}
