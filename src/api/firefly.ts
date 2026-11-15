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
  description: string;
  amount: string;
  date: string; // YYYY-MM-DD
  sourceId: string;
  destinationName: string;
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

  async deleteAccount(id: string) {
    await this.send('delete', `/accounts/${id}`);
  }

  async createWithdrawal(t: NewWithdrawal) {
    const { data } = await this.send<Resource<{ transactions: { description: string }[] }>>('post', '/transactions', {
      error_if_duplicate_hash: false,
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
    return { id: data.id };
  }
}
