import { expect, type APIRequestContext } from '@playwright/test';

// Thin client over the Firefly III REST API (/api/v1, JSON:API responses).
// Typed by hand for the endpoints the suite uses; see https://api-docs.firefly-iii.org.

type Resource<T> = { data: { id: string; type: string; attributes: T } };

export type Account = {
  name: string;
  type: string;
  current_balance: string;
  currency_code: string;
};

export type NewAssetAccount = {
  name: string;
  openingBalance: string;
  openingBalanceDate: string; // YYYY-MM-DD
};

export type NewWithdrawal = {
  /** Defaults to true, like the web form. */
  applyRules?: boolean;
  description: string;
  amount: string;
  date: string; // YYYY-MM-DD
  sourceId: string;
  destinationName: string;
};

export type NewTransfer = {
  description: string;
  amount: string;
  date: string; // YYYY-MM-DD
  sourceId: string;
  destinationId: string;
};

/** Raw split as the API takes it, for negative tests that send invalid data on purpose. */
export type RawSplit = Record<string, string | undefined>;

export type Split = { description: string; category_name: string | null; amount: string };

export type NewRule = {
  title: string;
  groupId: string;
  /** e.g. { type: 'description_contains', value: 'rent' } */
  triggers: { type: string; value: string }[];
  /** e.g. { type: 'set_category', value: 'Housing' } */
  actions: { type: string; value: string }[];
};

export class FireflyApi {
  constructor(private readonly request: APIRequestContext) {}

  private async send<T>(method: 'get' | 'post' | 'delete', path: string, data?: unknown): Promise<T> {
    const res = await this.request[method](`/api/v1${path}`, { data });
    expect(res, `${method.toUpperCase()} ${path}: ${await res.text()}`).toBeOK();
    return res.status() === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  async createAssetAccount(a: NewAssetAccount) {
    const { data } = await this.send<Resource<Account>>('post', '/accounts', {
      name: a.name,
      type: 'asset',
      account_role: 'defaultAsset',
      opening_balance: a.openingBalance,
      opening_balance_date: a.openingBalanceDate,
    });
    return { id: data.id, ...data.attributes };
  }

  async getAccount(id: string) {
    const { data } = await this.send<Resource<Account>>('get', `/accounts/${id}`);
    return { id: data.id, ...data.attributes };
  }

  async findAssetAccounts(name: string) {
    const { data } = await this.send<{ data: { id: string; attributes: Account }[] }>(
      'get',
      `/search/accounts?field=name&type=asset&query=${encodeURIComponent(name)}`,
    );
    return data.filter((a) => a.attributes.name === name).map((a) => ({ id: a.id, ...a.attributes }));
  }

  async deleteAccount(id: string) {
    await this.send('delete', `/accounts/${id}`);
  }

  async createTransfer(t: NewTransfer) {
    const { data } = await this.send<Resource<unknown>>('post', '/transactions', {
      transactions: [
        {
          type: 'transfer',
          description: t.description,
          amount: t.amount,
          date: t.date,
          source_id: t.sourceId,
          destination_id: t.destinationId,
        },
      ],
    });
    return { id: data.id };
  }

  /** Posts a transaction without asserting success: returns the status and the JSON body. */
  async tryCreateTransaction(split: RawSplit) {
    const res = await this.request.post('/api/v1/transactions', { data: { transactions: [split] } });
    return { status: res.status(), body: (await res.json()) as { message?: string; errors?: Record<string, string[]> } };
  }

  /** Posts an asset account without asserting success. */
  async tryCreateAssetAccount(name: string) {
    const res = await this.request.post('/api/v1/accounts', {
      data: { name, type: 'asset', account_role: 'defaultAsset' },
    });
    return { status: res.status(), body: (await res.json()) as { errors?: Record<string, string[]> } };
  }

  async createRuleGroup(title: string) {
    const { data } = await this.send<Resource<unknown>>('post', '/rule-groups', { title });
    return { id: data.id };
  }

  /** Deleting a group also deletes its rules. */
  async deleteRuleGroup(id: string) {
    await this.send('delete', `/rule-groups/${id}`);
  }

  /** A rule that runs when a transaction is stored ("store-journal"). */
  async createRule(r: NewRule) {
    const { data } = await this.send<Resource<unknown>>('post', '/rules', {
      title: r.title,
      rule_group_id: r.groupId,
      trigger: 'store-journal',
      active: true,
      strict: true,
      triggers: r.triggers,
      actions: r.actions,
    });
    return { id: data.id };
  }

  /** Runs a rule on transactions that already exist in the given accounts and period. */
  async fireRule(id: string, accountIds: string[], start: string, end: string) {
    const query = new URLSearchParams({ start, end });
    for (const a of accountIds) query.append('accounts[]', a);
    await this.send('post', `/rules/${id}/trigger?${query}`, {}); // Firefly rejects a POST without Content-Type
  }

  async getTransaction(id: string) {
    const { data } = await this.send<Resource<{ transactions: Split[] }>>('get', `/transactions/${id}`);
    return data.attributes.transactions[0];
  }

  async deleteCategoryNamed(name: string) {
    const { data } = await this.send<{ data: { id: string; attributes: { name: string } }[] }>('get', '/categories?limit=200');
    for (const c of data.filter((c) => c.attributes.name === name)) await this.send('delete', `/categories/${c.id}`);
  }

  /** Admin only. Deleting a user also deletes all of their data. */
  async deleteUserByEmail(email: string) {
    const { data } = await this.send<{ data: { id: string; attributes: { email: string } }[] }>('get', '/users?limit=1000');
    for (const u of data.filter((u) => u.attributes.email === email)) await this.send('delete', `/users/${u.id}`);
  }

  /** Sets a user preference, creating it if the user does not have it yet. */
  async setPreference(name: string, data: unknown) {
    const res = await this.request.put(`/api/v1/preferences/${name}`, { data: { data } });
    if (res.status() === 404) await this.send('post', '/preferences', { name, data });
    else expect(res, `PUT /preferences/${name}: ${await res.text()}`).toBeOK();
  }

  async createWithdrawal(t: NewWithdrawal) {
    const { data } = await this.send<Resource<{ transactions: Split[] }>>('post', '/transactions', {
      error_if_duplicate_hash: false,
      apply_rules: t.applyRules ?? true,
      transactions: [
        {
          type: 'withdrawal',
          description: t.description,
          amount: t.amount,
          date: t.date,
          source_id: t.sourceId,
          destination_name: t.destinationName,
        },
      ],
    });
    return { id: data.id, ...data.attributes.transactions[0] };
  }
}
