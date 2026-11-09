import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)

/**
 * End-to-end tests against the dev server (the lesson editor exposes a
 * test hook only in development). Uses the installed Chrome.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    locale: 'ru-RU',
    timezoneId: 'Asia/Almaty',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1366, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: false } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/ru`,
    reuseExistingServer: true,
    timeout: 180_000,
    // Tests answer for Gemini themselves: without keys the server could not reach it even by mistake.
    env: { GEMINI_API_KEY: '', GEMINI_API_KEY_DEV: '', GEMINI_MENTOR_API_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' },
  },
})
