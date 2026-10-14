// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: [['list'], ['json', { outputFile: '../../evidence/tests/e2e-results.json' }]],
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000', trace: 'off' },
  projects: [
    { name: 'escritorio-1366', use: { browserName: 'chromium', viewport: { width: 1366, height: 900 } } },
    { name: 'movil-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node apps/api/src/server.js',
    cwd: '../..',
    url: 'http://localhost:3000/api/ready',
    reuseExistingServer: true,
    env: { LOG_SILENT: 'true', AI_PROVIDER: 'none' },
  },
});
