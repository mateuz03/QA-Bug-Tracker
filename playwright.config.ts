import { defineConfig, devices } from '@playwright/test';

const apiOnly = process.argv.some((argument) => argument.includes('project=api'));

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      use: { baseURL: 'http://127.0.0.1:3001' }
    }
  ],
  webServer: [
    {
      command: 'npm run start:test',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    ...(!apiOnly ? [{
      command: 'node node_modules/vite/bin/vite.js frontend --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }] : [])
  ]
});
