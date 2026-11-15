import { test as setup, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { STORAGE_STATE } from '../../playwright.config';

// The test account lives only in the throwaway Docker instance.
// The first run registers it (the first user of a fresh Firefly III becomes admin);
// later runs log in with the credentials saved in .auth/ (gitignored).
const CREDENTIALS = '.auth/credentials.json';
const email = 'qa@example.test';

setup('authenticate', async ({ page }) => {
  mkdirSync('.auth', { recursive: true });
  const known = existsSync(CREDENTIALS);
  const password = known
    ? (JSON.parse(readFileSync(CREDENTIALS, 'utf8')) as { password: string }).password
    : randomBytes(18).toString('base64url');

  if (!known) {
    await page.goto('/register');
    await page.getByRole('textbox', { name: /email/i }).or(page.locator('input[name="email"]')).fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="password_confirmation"]').fill(password);
    await page.locator('form[action$="/register"] button[type="submit"]').click();
    writeFileSync(CREDENTIALS, JSON.stringify({ email, password }));
  } else {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form[action$="/login"] button[type="submit"]').click();
  }

  await expect(page).not.toHaveURL(/\/(login|register)/);
  await page.context().storageState({ path: STORAGE_STATE });
});
