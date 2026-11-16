import { test, expect } from '@playwright/test';

test('a signed-in user reaches the app, not the login page', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).toHaveTitle(/Firefly III/);
});
