import { test, expect } from '../../src/fixtures';
import { USERS } from '../../playwright.config';

// The same isolation, seen from the browser: another user who opens the URL of the
// owner's account page gets no data, whatever the page says.

test.describe('another user in the browser', { tag: '@security' }, () => {
  test.use({ storageState: USERS.other.storageState });

  test("opening the URL of someone else's account shows none of its data", async ({ page, assetAccount }) => {
    const account = await assetAccount({ name: `Private ${Date.now()}`, openingBalance: '4321.09' });

    const res = await page.goto(`/accounts/show/${account.id}`);

    expect(res?.status()).toBe(404);
    await expect(page.getByText(account.name)).toHaveCount(0);
    await expect(page.getByText('4,321.09')).toHaveCount(0);
  });
});
