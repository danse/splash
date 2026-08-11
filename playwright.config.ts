import { defineConfig } from '@playwright/test'

const VW = 1280
const VH = 720

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    hasTouch: true,
    deviceScaleFactor: 1,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'touch-landscape',
      use: {
        viewport: { width: VW, height: VH },
        hasTouch: true,
        isMobile: false,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
