import { test, expect } from '../../src/fixtures';
import { WithdrawalForm } from '../../src/pages/withdrawal-form';

// A withdrawal entered with the keyboard only: no click, no programmatic focus.
// axe checks markup; this checks that a keyboard user can actually get through the form.

test('a withdrawal can be entered and submitted with the keyboard only', async ({ page, api, assetAccount }) => {
  const account = await assetAccount({ openingBalance: '100' });
  const form = new WithdrawalForm(page);

  // The guided tour is marked as seen in setup; closing it with the keyboard is guided-tour.spec.ts.
  await form.open();

  // The first field has autofocus: a keyboard user starts in the form, not in the 27 menu stops.
  await expect(form.description).toBeFocused();

  await page.keyboard.type('Paid with the keyboard');
  await expect(form.description).toHaveValue('Paid with the keyboard');
  await form.tabTo(form.source, 3);
  await page.keyboard.type(account.name);
  await expect(page.getByRole('menuitem', { name: new RegExp(`^${account.name} `) })).toBeVisible(); // autocomplete
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(form.source).toHaveValue(account.name);

  await form.tabTo(form.destination, 3);
  await page.keyboard.type('Corner shop');
  await page.keyboard.press('Escape');

  // The date keeps today's value; its segments are Tab stops of their own.
  await form.tabTo(form.amount, 10);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('12.34');

  await form.tabTo(form.submit, 25);
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await api.getAccount(account.id)).current_balance).toBe('87.66');
});
