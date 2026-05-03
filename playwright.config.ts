import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1440, height: 1600 },
    ignoreHTTPSErrors: true,
    testIdAttribute: 'data-testid'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium'
      }
    }
  ],
  webServer: {
    command: `npx http-server . -p ${PORT} -a 127.0.0.1 -c-1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});