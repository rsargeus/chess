import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 30_000,
  reporter: 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user1.json',
      },
      dependencies: ['setup'],
    },
    {
      // Mobile-specific layout (library drawer, bottom sheet) has its own
      // failure modes that desktop can't catch — scoped to the spec that
      // exercises it rather than doubling the whole suite's runtime.
      // Pixel 7 (Chromium/Android) rather than an iOS device profile so this
      // reuses the already-installed Chromium engine instead of WebKit.
      name: 'mobile-chromium',
      testMatch: /opening-training\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        storageState: 'playwright/.auth/user1.json',
      },
      dependencies: ['setup'],
    },
  ],
});
