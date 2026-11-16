import { test, expect } from '../../src/fixtures';

// Data goes in through the API, the check happens in the UI.
// The account page titles its transaction list with the balance: "Transactions (€1,250.50)".

test('an account created through the API shows its opening balance in the UI', { tag: '@smoke' }, async ({ page, assetAccount }) => {
  const account = await assetAccount({ openingBalance: '1250.50' });

  await page.goto(`/accounts/show/${account.id}`);

  await expect(page.getByRole('heading', { name: `All transactions for account ${account.name}` })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transactions (€1,250.50)', exact: true })).toBeVisible();
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

  await page.goto(`/accounts/show/${account.id}/2026-11-01/2026-11-30`);
  await expect(page.getByRole('link', { name: 'Groceries' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Transactions (€957.70)', exact: true })).toBeVisible();
});
