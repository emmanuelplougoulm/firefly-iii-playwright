import { defineConfig, devices } from '@playwright/test';

/** Test users, created by tests/setup on a fresh instance. Files live in .auth/ (gitignored). */
export const USERS = {
  /** First user of the instance, so the admin. Owns all the data the tests create. */
  owner: {
    email: 'qa@example.test',
    credentials: '.auth/owner-credentials.json',
    storageState: '.auth/owner.json',
    token: '.auth/owner-token.json',
  },
  /** A second, regular user: used to check that one user cannot reach another's data. */
  other: {
    email: 'other@example.test',
    credentials: '.auth/other-credentials.json',
    storageState: '.auth/other.json',
    token: '.auth/other-token.json',
  },
} as const;

const signedIn = { storageState: USERS.owner.storageState };

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Screenshots differ between macOS and Linux: baselines come from CI only.
  ignoreSnapshots: !process.env.CI,
  // In CI each job writes a blob report; the merge job turns them into one HTML report.
  reporter: process.env.CI ? [['github'], ['list'], ['blob']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    // Business rules and authorization through the REST API: no browser.
    { name: 'api', testMatch: /api\/.*\.spec\.ts/, dependencies: ['setup'] },
    // Every browser test. Visual baselines and axe counts are recorded on Chromium only.
    {
      name: 'chromium',
      testMatch: /(e2e|visual|a11y)\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...signedIn },
      dependencies: ['setup'],
    },
    // User journeys on the two other engines.
    {
      name: 'firefox',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Firefox'], ...signedIn },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Safari'], ...signedIn },
      dependencies: ['setup'],
    },
  ],
});
