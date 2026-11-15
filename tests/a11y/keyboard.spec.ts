import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures';

// A withdrawal entered with the keyboard only: no click, no programmatic focus.
// axe checks markup; this checks that a keyboard user can actually get through the form.

/** Presses Tab until `target` has focus; fails if it takes more than `max` presses. */
async function tabTo(page: Page, target: Locator, max: number) {
  await expect(target).toBeAttached();
  for (let presses = 1; presses <= max; presses++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return presses;
  }
  const focused = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120));
  throw new Error(`Not reached with ${max} Tab presses: ${target}. Focus is on ${focused}`);
}

test('a withdrawal can be entered and submitted with the keyboard only', async ({ page, api, assetAccount }) => {
  const account = await assetAccount({ openingBalance: '100' });

  // A fresh user gets a guided tour that holds the focus. It must be closable from the keyboard.
  await page.goto('/transactions/create/withdrawal');
  const closeTour = page.getByRole('button', { name: 'Close Tour' });
  if (await closeTour.isVisible()) {
    await tabTo(page, closeTour, 3);
    await page.keyboard.press('Enter');
    await expect(closeTour).toBeHidden();
    await page.reload();
  }

  // The first field has autofocus: a keyboard user starts in the form, not in the 27 menu stops.
  await expect(page.locator('#description_0')).toBeFocused();

  await page.keyboard.type('Paid with the keyboard');
  await page.keyboard.press('Tab');
  await expect(page.locator('#source_0')).toBeFocused();
  await page.keyboard.type(account.name);
  await expect(page.getByRole('menuitem', { name: new RegExp(`^${account.name} `) })).toBeVisible(); // autocomplete
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#source_0')).toHaveValue(account.name);

  await page.keyboard.press('Tab');
  await expect(page.locator('#dest_0')).toBeFocused();
  await page.keyboard.type('Corner shop');
  await page.keyboard.press('Escape');

  // The date keeps today's value; its segments are Tab stops of their own.
  await tabTo(page, page.locator('#amount_0'), 10);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('12.34');

  await tabTo(page, page.getByRole('button', { name: 'Submit' }), 25);
  await page.keyboard.press('Enter');

  await expect.poll(async () => (await api.getAccount(account.id)).current_balance).toBe('87.66');
});
