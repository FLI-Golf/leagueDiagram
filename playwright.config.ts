import { defineConfig, devices } from '@playwright/test';

const DEMO_BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
const isLocalDevServer = DEMO_BASE_URL.includes('localhost') || DEMO_BASE_URL.includes('127.0.0.1');

export default defineConfig({
  testDir: './demo/scripts',
  testMatch: '**/*.spec.ts',
  outputDir: './demo/captures',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: DEMO_BASE_URL,
    trace: 'off',
    video: 'on',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only spin up a local dev server when targeting localhost; the deployed
  // demo (DEMO_BASE_URL=https://ld11.netlify.app/) doesn't need one.
  webServer: isLocalDevServer
    ? {
        command: 'npm run dev',
        url: DEMO_BASE_URL,
        reuseExistingServer: true,
        timeout: 30_000,
      }
    : undefined,
});
