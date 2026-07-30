import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: 'https://arenankalikesek.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: undefined,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
