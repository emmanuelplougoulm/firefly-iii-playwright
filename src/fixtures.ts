import { test as base, request, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { API_TOKEN } from '../playwright.config';
import { FireflyApi, type NewAssetAccount } from './api/firefly';

type Fixtures = {
  api: FireflyApi;
  /** Creates an asset account through the API and deletes it after the test. */
  assetAccount: (a?: Partial<NewAssetAccount>) => Promise<{ id: string; name: string }>;
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
});

export { expect } from '@playwright/test';
