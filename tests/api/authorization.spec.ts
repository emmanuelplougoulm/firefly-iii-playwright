import { test, expect } from '../../src/fixtures';

// Two users on the same instance: the owner (admin) and an unrelated regular user.
// The other user must not be able to read, change or use the owner's data by guessing ids,
// and must not reach admin-only endpoints. A miss here is a data leak (IDOR), not a UI bug.

test.describe('another user', { tag: '@security' }, () => {
  test('cannot read an account that is not theirs', async ({ otherUserRequest, assetAccount }) => {
    const account = await assetAccount();

    const res = await otherUserRequest.get(`/api/v1/accounts/${account.id}`);

    expect(res.status()).toBe(404); // not 403: the response must not confirm the id exists
  });

  test('does not see the account in their own list', async ({ otherUserRequest, assetAccount }) => {
    const account = await assetAccount();

    const res = await otherUserRequest.get('/api/v1/accounts?type=asset&limit=200');

    expect(res.status()).toBe(200);
    const { data } = (await res.json()) as { data: { id: string }[] };
    expect(data.map((a) => a.id)).not.toContain(account.id);
  });

  test('cannot delete an account that is not theirs', async ({ otherUserRequest, api, assetAccount }) => {
    const account = await assetAccount();

    const res = await otherUserRequest.delete(`/api/v1/accounts/${account.id}`);

    expect(res.status()).toBe(404);
    expect((await api.getAccount(account.id)).name).toBe(account.name);
  });

  test('cannot spend from an account that is not theirs', async ({ otherUserRequest, api, assetAccount }) => {
    const account = await assetAccount({ openingBalance: '100' });

    const res = await otherUserRequest.post('/api/v1/transactions', {
      data: {
        transactions: [{ type: 'withdrawal', description: 'Not mine', amount: '50', date: '2026-01-10', source_id: account.id, destination_name: 'Shop' }],
      },
    });

    expect(res.status()).toBe(422);
    expect((await api.getAccount(account.id)).current_balance).toBe('100.00');
  });

  test('cannot read a transaction that is not theirs', async ({ otherUserRequest, api, assetAccount }) => {
    const account = await assetAccount();
    const tx = await api.createWithdrawal({ description: 'Private', amount: '5', date: '2026-01-10', sourceId: account.id, destinationName: 'Shop' });

    const res = await otherUserRequest.get(`/api/v1/transactions/${tx.id}`);

    expect(res.status()).toBe(404);
  });

  test('cannot list the users of the instance (admin only)', async ({ otherUserRequest }) => {
    const res = await otherUserRequest.get('/api/v1/users');

    // Finding: Firefly III answers 401 (not signed in) to a signed-in user without the
    // right, where 403 is expected. Both refuse access, which is what matters here.
    expect([401, 403]).toContain(res.status());
    expect(await res.text()).not.toContain('qa@example.test');
  });
});

test('the admin can list the users of the instance', { tag: '@security' }, async ({ apiContext }) => {
  const res = await apiContext.get('/api/v1/users?limit=1000'); // the list is paginated, 50 by default

  expect(res.status()).toBe(200);
  const { data } = (await res.json()) as { data: { attributes: { email: string } }[] };
  expect(data.map((u) => u.attributes.email)).toEqual(expect.arrayContaining(['qa@example.test', 'other@example.test']));
});
