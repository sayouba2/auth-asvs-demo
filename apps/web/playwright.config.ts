import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['json', { outputFile: '../../security/evidence/playwright.json' }]],
  use: {
    baseURL: process.env.PUBLIC_ORIGIN ?? 'http://localhost:3100',
    trace: 'off',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: [
    { command: 'pnpm --filter @demo/api dev', cwd: '../..', url: (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3101') + '/api/auth/me',
      reuseExistingServer: false, timeout: 60000 },
    { command: 'pnpm --filter @demo/web dev', cwd: '../..', url: process.env.PUBLIC_ORIGIN ?? 'http://localhost:3100',
      reuseExistingServer: false, timeout: 120000 },
  ],
});
