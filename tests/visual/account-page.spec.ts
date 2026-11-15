import { test, expect } from '../../src/fixtures';

// Visual regression on the account page. What would make it flaky is pinned:
// - a past period (January 2026), so the chart has no moving "today" marker;
// - a fixed account name and fixed amounts and dates;
// - the header date range (it follows the current month) is masked.
// Baselines are generated on Linux in CI; local runs skip the comparison.

test.use({ viewport: { width: 1280, height: 900 } });

test('account page with a month of spending matches the baseline', async ({ page, api, assetAccount }) => {
  const account = await assetAccount({
    name: 'Everyday account',
    openingBalance: '2000',
    openingBalanceDate: '2026-01-01',
  });
  for (const [description, amount, date, shop] of [
    ['Groceries', '86.40', '2026-01-05', 'Corner shop'],
    ['Train pass', '75.20', '2026-01-08', 'Rail company'],
    ['Groceries', '64.15', '2026-01-19', 'Corner shop'],
  ] as const) {
    await api.createWithdrawal({ description, amount, date, sourceId: account.id, destinationName: shop });
  }

  const url = `/accounts/show/${account.id}/2026-01-01/2026-01-31`;
  // Finding: on the first view of a period, the server renders the month summary box
  // with 2 rows (Transactions, Spent); from the second view on, with 5 (Earned and
  // transfers too). Warm the server cache first so the baseline is the steady state.
  await page.goto(url);
  await page.goto(url);
  await expect(page.getByText('Transferred (in)')).toBeVisible();
  await expect(page.locator('body')).toContainText('€1,774.25');

  await expect(page).toHaveScreenshot('account-page.png', {
    fullPage: true,
    mask: [page.locator('#date-range')],
  });
});
