import { test as base, request, type APIRequestContext, type Page } from '@playwright/test';
import { newPassword, submitAuthForm } from './auth';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { USERS } from '../playwright.config';
import { FireflyApi, type NewAssetAccount } from './api/firefly';

/** An API context authenticated as one of the test users. */
export async function apiContextFor(user: keyof typeof USERS, baseURL: string | undefined) {
  const { accessToken } = JSON.parse(readFileSync(USERS[user].token, 'utf8')) as { accessToken: string };
  return request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.api+json' },
  });
}

type Fixtures = {
  /** API client signed in as the owner, who owns all the test data. */
  api: FireflyApi;
  /** Raw API context signed in as a second, unrelated user, for authorization checks. */
  otherUserRequest: APIRequestContext;
  /** A user registered for this test only, signed in on its own page; deleted afterwards. */
  newUser: { page: Page; email: string };
  /** Creates an asset account through the API and deletes it after the test. */
  assetAccount: (a?: Partial<NewAssetAccount>) => Promise<{ id: string; name: string }>;
  /**
   * A "description contains <keyword> -> category <category>" rule, in its own group.
   * Keyword and category are unique per test: rules apply to every new transaction of the
   * user, so a shared word like "Groceries" would also tag other tests' data.
   */
  categoryRule: () => Promise<{ id: string; keyword: string; category: string }>;
};

export const test = base.extend<Fixtures, { apiContext: APIRequestContext }>({
  apiContext: [
    async ({}, use, workerInfo) => {
      const ctx = await apiContextFor('owner', workerInfo.project.use.baseURL);
      await use(ctx);
      await ctx.dispose();
    },
    { scope: 'worker' },
  ],

  api: async ({ apiContext }, use) => use(new FireflyApi(apiContext)),

  newUser: async ({ browser, api }, use) => {
    const email = `new-${randomUUID().slice(0, 8)}@example.test`;
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await submitAuthForm(page, 'register', email, newPassword());
    await use({ page, email });
    await context.close();
    await api.deleteUserByEmail(email); // as the admin; also removes the user's data
  },

  otherUserRequest: async ({ baseURL }, use) => {
    const ctx = await apiContextFor('other', baseURL);
    await use(ctx);
    await ctx.dispose();
  },

  assetAccount: async ({ api }, use) => {
    const created: string[] = [];
    await use(async (a = {}) => {
      // A fixed name (visual tests) may be left over by an interrupted run: remove it first.
      if (a.name) for (const stale of await api.findAssetAccounts(a.name)) await api.deleteAccount(stale.id);
      const account = await api.createAssetAccount({
        // Unique names keep parallel tests independent.
        name: a.name ?? `Checking ${randomUUID().slice(0, 8)}`,
        openingBalance: a.openingBalance ?? '1000',
        openingBalanceDate: a.openingBalanceDate ?? '2026-01-01',
      });
      created.push(account.id);
      return account;
    });
    for (const id of created) await api.deleteAccount(id);
  },

  categoryRule: async ({ api }, use) => {
    const groups: string[] = [];
    const categories: string[] = [];
    await use(async () => {
      const tag = randomUUID().slice(0, 8);
      const keyword = `grocery-${tag}`;
      const category = `Food ${tag}`;
      const group = await api.createRuleGroup(`Rules ${tag}`);
      groups.push(group.id);
      categories.push(category);
      const rule = await api.createRule({
        title: `Tag groceries ${tag}`,
        groupId: group.id,
        triggers: [{ type: 'description_contains', value: keyword }],
        actions: [{ type: 'set_category', value: category }],
      });
      return { id: rule.id, keyword, category };
    });
    for (const id of groups) await api.deleteRuleGroup(id);
    for (const name of categories) await api.deleteCategoryNamed(name);
  },
});

export { expect } from '@playwright/test';
