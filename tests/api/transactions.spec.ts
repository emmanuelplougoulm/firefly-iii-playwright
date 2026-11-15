import { request } from '@playwright/test';
import { test, expect } from '../../src/fixtures';

// Business rules checked at the API layer only: fast, no browser.

test.describe('money movements', () => {
  test('a transfer moves money between two accounts and keeps the total', async ({ api, assetAccount }) => {
    const from = await assetAccount({ openingBalance: '100' });
    const to = await assetAccount({ openingBalance: '0' });

    await api.createTransfer({ description: 'Savings', amount: '30', date: '2026-01-10', sourceId: from.id, destinationId: to.id });

    expect((await api.getAccount(from.id)).current_balance).toBe('70.00');
    expect((await api.getAccount(to.id)).current_balance).toBe('30.00');
  });

  test('amounts add up to the cent, without floating-point drift', async ({ api, assetAccount }) => {
    const account = await assetAccount({ openingBalance: '1' });
    for (const amount of ['0.10', '0.20']) {
      await api.createWithdrawal({ description: 'Coffee', amount, date: '2026-01-10', sourceId: account.id, destinationName: 'Cafe' });
    }
    // 1 - 0.1 - 0.2 is 0.7 exactly; binary floats would give 0.7000000000000001.
    expect((await api.getAccount(account.id)).current_balance).toBe('0.70');
  });

  test('a withdrawal larger than the balance is accepted and the balance goes negative', async ({ api, assetAccount }) => {
    // Firefly III records what happened; it has no overdraft guard. This test pins that behaviour.
    const account = await assetAccount({ openingBalance: '100' });
    await api.createWithdrawal({ description: 'Laptop', amount: '500', date: '2026-01-11', sourceId: account.id, destinationName: 'Shop' });
    expect((await api.getAccount(account.id)).current_balance).toBe('-400.00');
  });
});

test.describe('validation', () => {
  for (const amount of ['0', '-5']) {
    test(`rejects a withdrawal of ${amount}`, async ({ api, assetAccount }) => {
      const account = await assetAccount();
      const { status, body } = await api.tryCreateTransaction({
        type: 'withdrawal', description: 'Invalid', amount, date: '2026-01-10', source_id: account.id, destination_name: 'Shop',
      });
      expect(status).toBe(422);
      expect(body.errors?.['transactions.0.amount']).toEqual(['The value must be more than zero.']);
    });
  }

  test('rejects a transfer from an account to itself', async ({ api, assetAccount }) => {
    const account = await assetAccount();
    const { status, body } = await api.tryCreateTransaction({
      type: 'transfer', description: 'Loop', amount: '5', date: '2026-01-10', source_id: account.id, destination_id: account.id,
    });
    expect(status).toBe(422);
    expect(body.errors?.['transactions.0.destination_id']).toEqual(['Source and destination are the same.']);
  });

  test('rejects a withdrawal without a source account', async ({ api }) => {
    const { status, body } = await api.tryCreateTransaction({
      type: 'withdrawal', description: 'Orphan', amount: '5', date: '2026-01-10', destination_name: 'Shop',
    });
    expect(status).toBe(422);
    expect(Object.keys(body.errors ?? {})).toContain('transactions.0.source_id');
  });

  test('rejects a second account with the same name', async ({ api, assetAccount }) => {
    const account = await assetAccount();
    const { status, body } = await api.tryCreateAssetAccount(account.name);
    expect(status).toBe(422);
    expect(body.errors?.name).toEqual(['This account name is already in use.']);
  });
});

test('the API refuses requests without a token', async ({ baseURL }) => {
  const anonymous = await request.newContext({ baseURL, extraHTTPHeaders: { Accept: 'application/vnd.api+json' } });
  const res = await anonymous.get('/api/v1/accounts');
  expect(res.status()).toBe(401);
  await anonymous.dispose();
});
