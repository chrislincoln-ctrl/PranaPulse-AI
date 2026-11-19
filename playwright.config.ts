import { defineConfig, devices } from '@playwright/test';

const BASE_PORT = 4179;
const BASE_URL = `http://127.0.0.1:${BASE_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.CI ? {} : { channel: 'msedge' }),
      },
    },
  ],
  webServer: {
    command: 'node dist-server/index.mjs',
    url: `${BASE_URL}/api/health`,
    timeout: 15_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(BASE_PORT),
      NODE_ENV: 'production',
    },
  },
});
