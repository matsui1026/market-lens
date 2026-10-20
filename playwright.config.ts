import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true'
const vite = 'node node_modules/vite/bin/vite.js'

/** Settings shared by both local servers: fake API, isolated cache, no real .env.local. */
const localEnv = {
  JQUANTS_API_BASE: 'http://127.0.0.1:4599',
  JQUANTS_RATE_LIMIT_PER_MIN: '1000',
  MARKET_LENS_NO_ENV_FILE: '1',
}

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    // Locally use the installed Edge so no browser download is needed; CI uses Playwright's Chromium.
    ...(isCI ? {} : { channel: 'msedge' }),
    trace: 'retain-on-failure',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    {
      name: 'demo',
      testMatch: /demo\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(isCI ? {} : { channel: 'msedge' }),
        baseURL: 'http://127.0.0.1:4174',
      },
    },
    {
      name: 'local',
      testMatch: /local\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(isCI ? {} : { channel: 'msedge' }),
        baseURL: 'http://127.0.0.1:4175',
      },
    },
  ],
  webServer: [
    {
      command: `${vite} preview --mode demo --host 127.0.0.1 --port 4174 --strictPort`,
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !isCI,
    },
    {
      // Answers 403 without a key, which Playwright accepts as "up".
      command: 'node e2e/fakeJquants.mjs',
      url: 'http://127.0.0.1:4599/health',
      reuseExistingServer: !isCI,
    },
    {
      command: `${vite} preview --host 127.0.0.1 --port 4175 --strictPort`,
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: !isCI,
      env: {
        ...localEnv,
        JQUANTS_API_KEY: 'e2e-test-key-not-a-real-secret',
        MARKET_LENS_CACHE_DIR: 'test-results/e2e-cache-key',
      },
    },
    {
      command: `${vite} preview --host 127.0.0.1 --port 4176 --strictPort`,
      url: 'http://127.0.0.1:4176',
      reuseExistingServer: !isCI,
      env: { ...localEnv, MARKET_LENS_CACHE_DIR: 'test-results/e2e-cache-nokey' },
    },
  ],
})
