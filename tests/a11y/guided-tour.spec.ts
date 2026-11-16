import { test, expect } from '../../src/fixtures';
import { WithdrawalForm } from '../../src/pages/withdrawal-form';

// On a user's first visit, the withdrawal form opens a guided tour that takes the focus.
// A keyboard user must be able to close it without a mouse.
// Whether the tour was seen is stored per user on the server, so the test uses a user
// registered for it alone: it shares no state with other tests and can run any number of times.

test('a new user can close the guided tour on the withdrawal form with the keyboard', async ({ newUser: { page } }) => {
  const form = new WithdrawalForm(page);

  await page.goto('/transactions/create/withdrawal', { waitUntil: 'networkidle' });
  // The tour is a <dialog> that takes the focus when it opens: keyboard users start inside it.
  const tour = page.locator('dialog.shepherd-element');
  await expect(tour).toBeFocused();

  await form.tabTo(form.closeTour, 3);
  const recorded = page.waitForResponse((r) => r.url().includes('/json/intro/finished/') && r.request().method() === 'POST');
  await page.keyboard.press('Enter');

  await expect(tour).toBeHidden();
  // Closing the tour records it as seen (a request in the background):
  // once that is done, the tour does not come back on the next visit.
  expect((await recorded).ok()).toBe(true);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(form.description).toBeEditable();
  await expect(form.closeTour).toBeHidden();
});
