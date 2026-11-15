import { test, expect } from '../../src/fixtures';

// Data goes in through the API, the check happens in the UI.

test('an account created through the API shows its opening balance in the UI', async ({ page, assetAccount }) => {
  const account = await assetAccount({ openingBalance: '1250.50' });

  await page.goto(`/accounts/show/${account.id}`);

  await expect(page.getByRole('heading', { name: account.name }).first()).toBeVisible();
  await expect(page.locator('body')).toContainText('€1,250.50');
});

test('a withdrawal lowers the balance shown on the account page', async ({ page, api, assetAccount }) => {
  const account = await assetAccount({ openingBalance: '1000' });
  await api.createWithdrawal({
    description: 'Groceries',
    amount: '42.30',
    date: '2026-11-02',
    sourceId: account.id,
    destinationName: 'Corner shop',
  });

  expect((await api.getAccount(account.id)).current_balance).toBe('957.70');

  await page.goto(`/accounts/show/${account.id}`);
  await expect(page.getByRole('link', { name: 'Groceries' })).toBeVisible();
  await expect(page.locator('body')).toContainText('€957.70');
});
