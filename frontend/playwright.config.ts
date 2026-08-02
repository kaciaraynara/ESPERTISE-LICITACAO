import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.E2E_DATABASE_URL;
const jwtSecret = process.env.E2E_JWT_SECRET;
const hasIsolatedEnvironment = Boolean(
  databaseUrl
  && jwtSecret
  && process.env.E2E_USER_EMAIL
  && process.env.E2E_USER_PASSWORD,
);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: hasIsolatedEnvironment ? [
    {
      command: 'npm run migrate && npm run dev',
      cwd: '../backend',
      url: 'http://127.0.0.1:3001/health/readiness',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: jwtSecret,
        ENABLE_BID_ROBOT: 'false',
        ENABLE_LEX: 'false',
        ENABLE_CRM: 'false',
        CORS_ORIGIN: 'http://127.0.0.1:4173',
        PORT: '3001',
      },
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:3001/api/v1' },
    },
  ] : undefined,
});
