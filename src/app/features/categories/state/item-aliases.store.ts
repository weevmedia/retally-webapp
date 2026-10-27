import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '@core/errors/app-error';
import { NotificationService } from '@core/notifications/notification.service';
import { ItemAlias, ItemAliasRepository } from '../data-access/item-alias.repository';

/** State for the "AI answers" review page: search / filter, paging, and per-line overrides. */
@Injectable()
export class ItemAliasesStore {
  private readonly repository = inject(ItemAliasRepository);
  private readonly notifications = inject(NotificationService);

  private readonly _rows = signal<ItemAlias[]>([]);
  private readonly _next = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal<string | null>(null);
  private readonly _search = signal('');
  private readonly _category = signal('');
  private requestId = 0;

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  /** The receipt text whose override is being saved, if any. */
  readonly saving = this._saving.asReadonly();
  readonly search = this._search.asReadonly();
  readonly category = this._category.asReadonly();
  readonly hasMore = computed(() => this._next() !== null);

  constructor() {
    void this.load(true);
  }

  setSearch(value: string): void {
    this._search.set(value);
    void this.load(true);
  }

  setCategory(value: string): void {
    this._category.set(value);
    void this.load(true);
  }

  loadMore(): void {
    if (this.hasMore() && !this._loading()) void this.load(false);
  }

  async override(row: ItemAlias, category: string): Promise<void> {
    if (category === row.category) return;
    this._saving.set(row.raw);
    try {
      await this.repository.setCategory(row.raw, category);
      this._rows.update((rows) =>
        rows.map((r) => (r.raw === row.raw ? { ...r, category, overridden: true } : r)),
      );
      this.notifications.success(`"${row.raw}" is now ${category.replace(/_/g, ' ')}`);
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
    } finally {
      this._saving.set(null);
    }
  }

  private async load(reset: boolean): Promise<void> {
    const id = ++this.requestId; // newer searches win over slower older ones
    this._loading.set(true);
    this._error.set(null);
    try {
      const page = await this.repository.list({
        search: this._search().trim(),
        category: this._category(),
        after: reset ? null : this._next(),
      });
      if (id !== this.requestId) return;
      this._rows.update((rows) => (reset ? page.rows : [...rows, ...page.rows]));
      this._next.set(page.next);
    } catch (e) {
      if (id === this.requestId) this._error.set(AppError.from(e).message);
    } finally {
      if (id === this.requestId) this._loading.set(false);
    }
  }
}
