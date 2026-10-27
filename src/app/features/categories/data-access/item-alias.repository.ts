import { Injectable, inject } from '@angular/core';
import { CallableApi } from '@core/api/callable';

/** One cached AI answer: a receipt line's text and the category the AI (or an admin) gave it. */
export interface ItemAlias {
  raw: string;
  name: string | null;
  category: string | null;
  overridden: boolean;
  overriddenBy: string | null;
  categorizedAt: string | null;
}

export interface ItemAliasQuery {
  search?: string;
  category?: string;
  after?: string | null;
}

export interface ItemAliasPage {
  rows: ItemAlias[];
  next: string | null;
}

/** Port for the AI's cached item categories (`itemAliases`), read and overridden via admin callables. */
export abstract class ItemAliasRepository {
  abstract list(query: ItemAliasQuery): Promise<ItemAliasPage>;
  abstract setCategory(raw: string, category: string): Promise<void>;
}

@Injectable()
export class CallableItemAliasRepository extends ItemAliasRepository {
  private readonly api = inject(CallableApi);

  list(query: ItemAliasQuery): Promise<ItemAliasPage> {
    return this.api.call<ItemAliasQuery, ItemAliasPage>('adminListItemAliases', {
      search: query.search || undefined,
      category: query.category || undefined,
      after: query.after || undefined,
    });
  }

  async setCategory(raw: string, category: string): Promise<void> {
    await this.api.call('adminSetItemCategory', { raw, category });
  }
}
