const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './ui',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false, // Ensure tests run sequentially (registration before login)
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    baseURL: process.env.BASE_URL || 'http://localhost',
    headless: !!process.env.CI, // Runs visibly on your local machine, headless in GitHub Actions
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
