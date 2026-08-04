import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const configuredBrowser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
const defaultWindowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const executablePath = configuredBrowser
  || (process.platform === 'win32' && existsSync(defaultWindowsChrome) ? defaultWindowsChrome : undefined)

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL,
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: undefined,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
