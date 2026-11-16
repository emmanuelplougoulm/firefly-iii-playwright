import { test as setup, expect, type Browser, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { USERS } from '../../playwright.config';
import { FireflyApi } from '../../src/api/firefly';
import { newPassword, submitAuthForm } from '../../src/auth';
import { apiContextFor } from '../../src/fixtures';
import { WithdrawalForm } from '../../src/pages/withdrawal-form';

// The test accounts live only in the throwaway Docker instance.
// The first run registers them (the first user of a fresh Firefly III becomes admin,
// so the owner is set up first); later runs log in with the credentials saved in
// .auth/ (gitignored). Each user also gets a personal access token for the API layer.

async function signIn(page: Page, user: (typeof USERS)[keyof typeof USERS]) {
  mkdirSync('.auth', { recursive: true });
  const known = existsSync(user.credentials);
  const password = known
    ? (JSON.parse(readFileSync(user.credentials, 'utf8')) as { password: string }).password
    : newPassword();

  await submitAuthForm(page, known ? 'login' : 'register', user.email, password);
  if (!known) writeFileSync(user.credentials, JSON.stringify({ email: user.email, password }));
  await page.context().storageState({ path: user.storageState });

  // Issued from the signed-in session, with the same call the "OAuth tokens" profile page makes.
  if (!existsSync(user.token)) {
    await page.goto('/profile/oauth');
    const csrf = await page.locator('meta[name="csrf-token"]').getAttribute('content');
    const res = await page.request.post('/oauth/personal-access-tokens', {
      headers: { 'X-CSRF-TOKEN': csrf ?? '', Accept: 'application/json' },
      data: { name: 'playwright' },
    });
    expect(res.status()).toBe(200);
    const { accessToken } = (await res.json()) as { accessToken: string };
    writeFileSync(user.token, JSON.stringify({ accessToken }));
  }
}

async function signInWithNewContext(browser: Browser, user: (typeof USERS)[keyof typeof USERS]) {
  const context = await browser.newContext();
  await signIn(await context.newPage(), user);
  await context.close();
}

setup('sign in the owner and a second, unrelated user', async ({ browser, baseURL }) => {
  // The owner first: the first user of the instance becomes its admin.
  await signInWithNewContext(browser, USERS.owner);

  // Firefly III closes registration after the first user ("single user mode").
  // The admin reopens it through the configuration API so a second user can sign up.
  const admin = await apiContextFor('owner', baseURL);
  const res = await admin.put('/api/v1/configuration/configuration.single_user_mode', { data: { value: false } });
  expect(res, await res.text()).toBeOK();
  await admin.dispose();

  await signInWithNewContext(browser, USERS.other);

  // The guided tour is per user and server-side: if tests opened the form while it is
  // still unseen, whichever closes it first would change what the others see.
  // (tests/a11y/guided-tour.spec.ts tests the tour with a brand-new user of its own.)
  for (const user of ['owner', 'other'] as const) {
    const ctx = await apiContextFor(user, baseURL);
    await new FireflyApi(ctx).setPreference(WithdrawalForm.TOUR_SEEN_PREFERENCE, true);
    await ctx.dispose();
  }
});
