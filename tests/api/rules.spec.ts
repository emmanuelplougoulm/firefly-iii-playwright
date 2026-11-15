import { test, expect } from '../../src/fixtures';

// Automation rules: "if the description contains X, set the category to Y".

const january = { date: '2026-01-10', destinationName: 'Market' };

test('a new matching transaction gets the category', async ({ api, assetAccount, categoryRule }) => {
  const account = await assetAccount();
  const rule = await categoryRule();

  const tx = await api.createWithdrawal({ ...january, description: `Weekly ${rule.keyword}`, amount: '20', sourceId: account.id });

  expect(tx.category_name).toBe(rule.category);
});

test('a transaction that does not match is left alone', async ({ api, assetAccount, categoryRule }) => {
  const account = await assetAccount();
  await categoryRule();

  const tx = await api.createWithdrawal({ ...january, description: 'Cinema', amount: '9', sourceId: account.id });

  expect(tx.category_name).toBeNull();
});

test('matching ignores case', async ({ api, assetAccount, categoryRule }) => {
  const account = await assetAccount();
  const rule = await categoryRule();

  const tx = await api.createWithdrawal({ ...january, description: rule.keyword.toUpperCase(), amount: '4', sourceId: account.id });

  expect(tx.category_name).toBe(rule.category);
});

test('rules are skipped when the transaction is stored with apply_rules off', async ({ api, assetAccount, categoryRule }) => {
  const account = await assetAccount();
  const rule = await categoryRule();

  const tx = await api.createWithdrawal({ ...january, applyRules: false, description: rule.keyword, amount: '5', sourceId: account.id });

  expect(tx.category_name).toBeNull();
});

test('firing a rule tags transactions that already exist', async ({ api, assetAccount, categoryRule }) => {
  const account = await assetAccount();
  const rule = await categoryRule();
  const tx = await api.createWithdrawal({ ...january, applyRules: false, description: rule.keyword, amount: '5', sourceId: account.id });

  await api.fireRule(rule.id, [account.id], '2026-01-01', '2026-01-31');

  // The run is not guaranteed to be finished when the call returns: poll.
  await expect.poll(async () => (await api.getTransaction(tx.id)).category_name).toBe(rule.category);
});
