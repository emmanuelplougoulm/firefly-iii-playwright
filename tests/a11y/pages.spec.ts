import { test } from '../../src/fixtures';
import { expectNoNewViolations } from '../../src/a11y';

// axe (WCAG 2.1 A/AA) on pages whose content the suite controls, so counts are stable.

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page', async ({ page }, testInfo) => {
    await page.goto('/login');
    await expectNoNewViolations(page, 'login', testInfo);
  });
});

test('account page', async ({ page, assetAccount }, testInfo) => {
  const account = await assetAccount({ openingBalance: '500', openingBalanceDate: '2026-01-01' });
  await page.goto(`/accounts/show/${account.id}/2026-01-01/2026-01-31`);
  await page.waitForLoadState('networkidle');
  await expectNoNewViolations(page, 'account-page', testInfo);
});

test('new withdrawal form', async ({ page }, testInfo) => {
  await page.goto('/transactions/create/withdrawal');
  await page.waitForLoadState('networkidle');
  await expectNoNewViolations(page, 'withdrawal-form', testInfo);
});

test('budgets page', async ({ page }, testInfo) => {
  await page.goto('/budgets');
  await page.waitForLoadState('networkidle');
  await expectNoNewViolations(page, 'budgets', testInfo);
});
