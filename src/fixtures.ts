import { test as base, request, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { API_TOKEN } from '../playwright.config';
import { FireflyApi, type NewAssetAccount } from './api/firefly';

type Fixtures = {
  api: FireflyApi;
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
      const { accessToken } = JSON.parse(readFileSync(API_TOKEN, 'utf8')) as { accessToken: string };
      const ctx = await request.newContext({
        baseURL: workerInfo.project.use.baseURL,
        extraHTTPHeaders: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.api+json' },
      });
      await use(ctx);
      await ctx.dispose();
    },
    { scope: 'worker' },
  ],

  api: async ({ apiContext }, use) => use(new FireflyApi(apiContext)),

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
