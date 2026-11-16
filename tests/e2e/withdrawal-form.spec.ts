import { test, expect } from '../../src/fixtures';
import { WithdrawalForm } from '../../src/pages/withdrawal-form';

// The withdrawal form posts to /api/v1/transactions from the browser.
// The happy path goes through the real API; failures are injected with page.route,
// because a real server error or a rejected amount cannot be produced on demand.

const TRANSACTIONS = '**/api/v1/transactions';

test.describe('withdrawal form', () => {
  test('a withdrawal entered in the form is stored and lowers the balance', { tag: '@smoke' }, async ({ page, api, assetAccount }) => {
    const account = await assetAccount({ openingBalance: '100' });
    const form = new WithdrawalForm(page);
    await form.open();

    await form.fill({ description: 'Bakery', sourceName: account.name, destinationName: 'Bakery shop', amount: '3.80' });
    const stored = page.waitForResponse((r) => r.url().endsWith('/api/v1/transactions') && r.request().method() === 'POST');
    await form.submit.click();

    expect((await stored).status()).toBe(200);
    await expect.poll(async () => (await api.getAccount(account.id)).current_balance).toBe('96.20');
  });

  test('a server error keeps the user on the form with their input and stores nothing', async ({ page, api, assetAccount }) => {
    const account = await assetAccount({ openingBalance: '100' });
    const form = new WithdrawalForm(page);
    await form.open();
    await page.route(TRANSACTIONS, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, json: { message: 'Internal Server Error' } })
        : route.fallback(),
    );

    await form.fill({ description: 'Bakery', sourceName: account.name, destinationName: 'Bakery shop', amount: '3.80' });
    await form.submit.click();

    await expect(form.errorBanner).toBeVisible();
    await expect(page).toHaveURL(/\/transactions\/create\/withdrawal/);
    await expect(form.description).toHaveValue('Bakery');
    await expect(form.amount).toHaveValue('3.80');
    expect((await api.getAccount(account.id)).current_balance).toBe('100.00');
  });

  test('a field rejected by the API is flagged on that field', async ({ page, assetAccount }) => {
    const account = await assetAccount({ openingBalance: '100' });
    const form = new WithdrawalForm(page);
    await form.open();
    // The exact body the API returns for a zero amount (see tests/api/transactions.spec.ts).
    await page.route(TRANSACTIONS, (route) =>
      route.fulfill({
        status: 422,
        json: { message: 'The given data was invalid.', errors: { 'transactions.0.amount': ['The value must be more than zero.'] } },
      }),
    );

    await form.fill({ description: 'Bakery', sourceName: account.name, destinationName: 'Bakery shop', amount: '3.80' });
    await form.submit.click();

    await expect(form.errorBanner).toBeVisible();
    await expect(form.amount).toHaveClass(/\bis-invalid\b/);
    await expect(form.description).not.toHaveClass(/\bis-invalid\b/);
    // Screen readers hear the field message through the page's live region...
    await expect(page.getByRole('status')).toHaveText('The value must be more than zero.');
  });

  test('the message for a rejected field is shown next to the field', async ({ page, assetAccount }) => {
    // Finding: the message is rendered in an .invalid-feedback element that Bootstrap keeps
    // hidden (it is not a sibling of the invalid input), so a sighted user only sees a red
    // border and an icon, never the reason. Marked as failing until Firefly III fixes it:
    // the day this test passes, Playwright reports it and the annotation must go.
    test.fail(true, 'Firefly III 6.7.9 hides the field error message (see README findings)');

    const account = await assetAccount({ openingBalance: '100' });
    const form = new WithdrawalForm(page);
    await form.open();
    await page.route(TRANSACTIONS, (route) =>
      route.fulfill({
        status: 422,
        json: { message: 'The given data was invalid.', errors: { 'transactions.0.amount': ['The value must be more than zero.'] } },
      }),
    );

    await form.fill({ description: 'Bakery', sourceName: account.name, destinationName: 'Bakery shop', amount: '3.80' });
    await form.submit.click();
    await expect(form.errorBanner).toBeVisible();

    await expect(page.locator('.invalid-feedback').getByText('The value must be more than zero.')).toBeVisible({ timeout: 2_000 });
  });
});
