import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The "Create new withdrawal" form (/transactions/create/withdrawal).
 * Built by Alpine.js after load: it posts to /api/v1/transactions from the browser.
 * Fields have no accessible name (see the README findings), so they are located by id.
 */
export class WithdrawalForm {
  readonly description: Locator;
  readonly source: Locator;
  readonly destination: Locator;
  readonly amount: Locator;
  readonly submit: Locator;
  /** The banner shown above the form when the API rejects the submission. */
  readonly errorBanner: Locator;

  constructor(private readonly page: Page) {
    this.description = page.locator('#description_0');
    this.source = page.locator('#source_0');
    this.destination = page.locator('#dest_0');
    this.amount = page.locator('#amount_0');
    this.submit = page.getByRole('button', { name: 'Submit' });
    this.errorBanner = page.getByRole('alert').filter({ hasText: 'There was something wrong with your submission' });
    this.closeTour = page.getByRole('button', { name: 'Close Tour' });
  }

  /** The guided tour shown on a user's first visit (see TOUR_SEEN_PREFERENCE). */
  readonly closeTour: Locator;

  /**
   * Server-side flag, per user: once set, the guided tour is not shown on this page.
   * tests/setup sets it for every test user, so no test meets the tour by accident;
   * tests/a11y/guided-tour.spec.ts clears it to test the tour on purpose.
   */
  static readonly TOUR_SEEN_PREFERENCE = 'shown_demo_transactions_create_withdrawal';

  /** Opens the form and waits until Alpine.js has built it: typing earlier is lost. */
  async open() {
    await this.page.goto('/transactions/create/withdrawal', { waitUntil: 'networkidle' });
    await expect(this.description).toBeEditable();
  }

  /** Fills the required fields with the mouse; the source is picked from the autocomplete. */
  async fill(w: { description: string; sourceName: string; destinationName: string; amount: string }) {
    await this.description.fill(w.description);
    await this.source.fill(w.sourceName);
    await this.page.getByRole('menuitem', { name: new RegExp(`^${w.sourceName} `) }).click();
    await expect(this.source).toHaveValue(w.sourceName);
    await this.destination.fill(w.destinationName);
    await this.destination.press('Tab'); // closes the destination autocomplete
    await this.amount.fill(w.amount);
  }

  /** Presses Tab until `target` has focus; fails if it takes more than `max` presses. */
  async tabTo(target: Locator, max: number) {
    await expect(target).toBeAttached();
    for (let presses = 1; presses <= max; presses++) {
      await this.page.keyboard.press('Tab');
      if (await target.evaluate((el) => el === document.activeElement)) return presses;
    }
    const focused = await this.page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120));
    throw new Error(`Not reached with ${max} Tab presses: ${target}. Focus is on ${focused}`);
  }
}
