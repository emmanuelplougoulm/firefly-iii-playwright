import { expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

/** A random password, for throwaway users of the Docker instance only. */
export const newPassword = () => randomBytes(18).toString('base64url');

/** Fills and submits the register or login form, then checks the user is signed in. */
export async function submitAuthForm(page: Page, action: 'register' | 'login', email: string, password: string) {
  await page.goto(`/${action}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  if (action === 'register') await page.locator('input[name="password_confirmation"]').fill(password);
  await page.locator(`form[action$="/${action}"] button[type="submit"]`).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
}
