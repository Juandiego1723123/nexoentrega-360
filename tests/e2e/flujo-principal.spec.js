// RNF05 y recorrido principal (acta 8.5) por la interfaz, en 1366 y 390 px.
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { seed } = require('../../apps/api/scripts/seed');
const { pool } = require('../../apps/api/src/db');

const PASS = process.env.SEED_PASSWORD || 'NexoDemo2026!';
const SHOTS = path.resolve(__dirname, '../../evidence/screenshots');

test.beforeEach(async () => { await seed(pool); });
test.afterAll(async () => { await pool.end(); });

async function captura(page, nombre, info) {
  await page.screenshot({ path: path.join(SHOTS, `${nombre}-${info.project.name}.png`), fullPage: true });
}
async function entrar(page, email) {
  await page.goto('/');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(PASS);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}
async function salir(page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Correo')).toBeVisible();
}
async function sinDesbordamiento(page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, 'desbordamiento horizontal').toBeLessThanOrEqual(iw);
}
async function abrirSolicitud(page, codigo) {
  await page.getByRole('button', { name: 'Solicitudes', exact: true }).click();
  await page.getByRole('button', { name: codigo, exact: true }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Solicitud ${codigo}`) })).toBeVisible();
}

test('E2E-01 recorrido principal: crear → enviar → reservar → despachar → entregar → auditoría', async ({ page }, info) => {
  await entrar(page, 'org-a-solicitante@example.test');
  await captura(page, '02-listado-solicitante', info);
  await page.getByRole('button', { name: 'Nueva solicitud' }).click();
  await page.getByLabel('Zona').selectOption('CENTRO');
  await page.getByLabel('Prioridad').selectOption('ALTA');
  await page.getByLabel('Fecha requerida').fill('2030-02-01T10:00');
  await page.getByLabel(/Observaciones/).fill('Entrega para comedor comunitario');
  await page.getByLabel('Producto 1').selectOption('KIT-AGUA');
  await page.getByLabel('Cantidad').fill('4');
  await sinDesbordamiento(page);
  await captura(page, '03-formulario', info);
  await page.getByRole('button', { name: 'Guardar y enviar' }).click();
  await expect(page.getByRole('heading', { name: /Solicitud A-003/ })).toBeVisible();
  await expect(page.locator('h1 .estado')).toHaveText('ENVIADA');
  await salir(page);

  await entrar(page, 'org-a-coordinador@example.test');
  await abrirSolicitud(page, 'A-003');
  await page.getByRole('button', { name: 'Reservar inventario' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Inventario reservado' })).toBeVisible();
  await expect(page.getByText('KIT-AGUA: físico 20, reservado 4, disponible 16')).toBeVisible();
  await sinDesbordamiento(page);
  await captura(page, '04-detalle-reservada', info);
  await salir(page);

  await entrar(page, 'org-a-bodega@example.test');
  await abrirSolicitud(page, 'A-003');
  await page.getByRole('button', { name: 'Despachar' }).click();
  await expect(page.locator('h1 .estado')).toHaveText('DESPACHADA');
  await page.getByRole('button', { name: 'Inventario' }).click();
  await expect(page.getByRole('heading', { name: 'Inventario' })).toBeVisible();
  await sinDesbordamiento(page);
  await captura(page, '05-inventario', info);
  await salir(page);

  await entrar(page, 'org-a-coordinador@example.test');
  await abrirSolicitud(page, 'A-003');
  await page.getByRole('button', { name: 'Registrar entrega' }).click();
  await expect(page.locator('h1 .estado')).toHaveText('ENTREGADA');
  await salir(page);

  await entrar(page, 'org-a-auditor@example.test');
  await page.getByRole('button', { name: 'Auditoría' }).click();
  for (const accion of ['ENVIAR', 'RESERVAR', 'DESPACHAR', 'ENTREGAR']) {
    await expect(page.locator('td[data-label="Acción"]').filter({ hasText: new RegExp(`^${accion}$`) })).toBeVisible();
  }
  await sinDesbordamiento(page);
  await captura(page, '06-auditoria', info);
  const { rows } = await pool.query("SELECT accion FROM audit_events WHERE recurso_id = 'A-003' ORDER BY id");
  expect(rows.map((r) => r.accion)).toEqual(['ENVIAR', 'RESERVAR', 'DESPACHAR', 'ENTREGAR']);
});

test('E2E-02 errores asociados a su campo: credenciales y cantidad inválida', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('Correo').fill('org-a-solicitante@example.test');
  await page.getByLabel('Contraseña').fill('incorrecta1');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos');
  await captura(page, '01-login-error', info);
  await page.getByLabel('Contraseña').fill(PASS);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('button', { name: 'Nueva solicitud' }).click();
  await expect(page.locator('#sku-0 option').first()).toBeAttached(); // catálogo cargado
  await page.getByLabel('Fecha requerida').fill('2030-02-01T10:00');
  await page.getByLabel('Cantidad').fill('0');
  await page.getByRole('button', { name: 'Guardar y enviar' }).click();
  const cantidad = page.getByLabel('Cantidad');
  await expect(cantidad).toHaveAttribute('aria-invalid', 'true');
  const idError = await cantidad.getAttribute('aria-describedby');
  await expect(page.locator(`#${idError}`)).toHaveText(/entero entre 1 y 500/);
  await sinDesbordamiento(page);
  await captura(page, '07-error-de-campo', info);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM requests WHERE org_id = 'ORG-A'");
  expect(rows[0].n).toBe(2); // no se creó nada con la cantidad inválida
});

test('E2E-03 inicio de sesión y navegación solo con teclado', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Correo')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Correo')).toBeFocused();
  await page.keyboard.type('org-a-coordinador@example.test');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Contraseña')).toBeFocused();
  await page.keyboard.type(PASS);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  const destino = page.getByRole('button', { name: 'A-001', exact: true });
  for (let i = 0; i < 25 && !(await destino.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(destino).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Solicitud A-001/ })).toBeVisible();
  const reservar = page.getByRole('button', { name: 'Reservar inventario' });
  for (let i = 0; i < 15 && !(await reservar.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(reservar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('h1 .estado')).toHaveText('RESERVADA');
});

test('E2E-04 aislamiento en la interfaz: ORG-B no ve datos de ORG-A', async ({ page }, info) => {
  await entrar(page, 'org-b-coordinador@example.test');
  await expect(page.getByRole('button', { name: 'B-001', exact: true })).toBeVisible();
  await expect(page.getByText('A-001')).toHaveCount(0);
  await sinDesbordamiento(page);
  await captura(page, '08-listado-org-b', info);
  const r = await page.evaluate(async () => (await fetch('/api/requests/A-001')).status);
  expect(r).toBe(404);
});

test('E2E-05 asistente de IA: borrador marcado, aviso de degradación y aprobación humana', async ({ page }, info) => {
  await entrar(page, 'org-a-coordinador@example.test');
  await page.getByRole('button', { name: 'Asistente IA' }).click();
  await page.getByLabel(/^A-001/).check();
  await page.getByLabel(/^A-002/).check();
  await page.getByRole('button', { name: 'Generar resumen' }).click();
  await expect(page.locator('.sello')).toHaveText('Asistencia de IA');
  await expect(page.getByText(/sin proveedor de IA configurado/)).toBeVisible();
  await expect(page.locator('.recs li').first()).toContainText('A-001'); // prioridad ALTA primero
  await sinDesbordamiento(page);
  await captura(page, '09-asistente-borrador', info);
  const antes = (await pool.query('SELECT estado, prioridad FROM requests ORDER BY code')).rows;
  await page.getByRole('button', { name: 'Aprobar resumen' }).click();
  await expect(page.getByText(/Resumen aprobado/)).toBeVisible();
  await captura(page, '10-asistente-aprobado', info);
  expect((await pool.query('SELECT estado, prioridad FROM requests ORDER BY code')).rows).toEqual(antes);
  expect(await page.evaluate(() => window.__unsafe)).toBeUndefined();
});
