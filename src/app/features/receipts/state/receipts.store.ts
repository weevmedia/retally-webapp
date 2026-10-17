import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '@core/errors/app-error';
import { NotificationService } from '@core/notifications/notification.service';
import {
  DEFAULT_FILTERS, ReceiptFilters, ReceiptSearchResult, SortDir, SortField, toCsv,
} from '../domain/receipt.model';
import { ReceiptRepository } from '../data-access/receipt.repository';

const EXPORT_LIMIT = 5000;

/**
 * Feature state for Receipts. Filters, sort and page live here; every change triggers one search.
 * Responses that arrive after a newer request are dropped, so fast typing never shows stale rows.
 */
@Injectable()
export class ReceiptsStore {
  private readonly repository = inject(ReceiptRepository);
  private readonly notifications = inject(NotificationService);

  private readonly _filters = signal<ReceiptFilters>(DEFAULT_FILTERS);
  private readonly _sortField = signal<SortField>('date');
  private readonly _sortDir = signal<SortDir>('desc');
  private readonly _page = signal(0);
  private readonly _pageSize = signal(25);
  private readonly _result = signal<ReceiptSearchResult | null>(null);
  private readonly _loading = signal(false);
  private readonly _exporting = signal(false);
  private readonly _error = signal<string | null>(null);
  private requestSeq = 0;

  readonly filters = this._filters.asReadonly();
  readonly sortField = this._sortField.asReadonly();
  readonly sortDir = this._sortDir.asReadonly();
  readonly page = this._page.asReadonly();
  readonly pageSize = this._pageSize.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly exporting = this._exporting.asReadonly();
  readonly error = this._error.asReadonly();

  readonly rows = computed(() => this._result()?.rows ?? []);
  readonly total = computed(() => this._result()?.total ?? 0);
  readonly summary = computed(() => this._result()?.summary ?? null);
  readonly facets = computed(() => this._result()?.facets ?? null);
  readonly truncated = computed(() => this._result()?.truncated ?? false);
  readonly scanned = computed(() => this._result()?.scanned ?? 0);
  readonly userNotFound = computed(() => this._result()?.userNotFound ?? false);
  readonly loaded = computed(() => this._result() !== null);

  /** Replaces the filters (page goes back to the first) and searches. */
  setFilters(filters: ReceiptFilters): void {
    this._filters.set(filters);
    this._page.set(0);
    void this.load();
  }

  setSort(field: SortField, dir: SortDir): void {
    this._sortField.set(field);
    this._sortDir.set(dir);
    this._page.set(0);
    void this.load();
  }

  setPage(page: number, pageSize: number): void {
    if (pageSize !== this._pageSize()) page = 0;
    this._page.set(page);
    this._pageSize.set(pageSize);
    void this.load();
  }

  refresh(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this._loading.set(true);
    try {
      const result = await this.repository.search({
        filters: this._filters(),
        sortField: this._sortField(),
        sortDir: this._sortDir(),
        page: this._page(),
        pageSize: this._pageSize(),
      });
      if (seq !== this.requestSeq) return;
      this._result.set(result);
      this._error.set(null);
    } catch (e) {
      if (seq !== this.requestSeq) return;
      this._error.set(AppError.from(e).message);
    } finally {
      if (seq === this.requestSeq) this._loading.set(false);
    }
  }

  /** Downloads every receipt matching the current filters (up to 5,000) as CSV. */
  async exportCsv(): Promise<void> {
    this._exporting.set(true);
    try {
      const result = await this.repository.search({
        filters: this._filters(),
        sortField: this._sortField(),
        sortDir: this._sortDir(),
        page: 0,
        pageSize: EXPORT_LIMIT,
      });
      const blob = new Blob([toCsv(result.rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retally-receipts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      const capped = result.total > result.rows.length || result.truncated;
      this.notifications.success(`Exported ${result.rows.length} receipts${capped ? ' (limit reached — narrow the filters for the rest)' : ''}`);
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
    } finally {
      this._exporting.set(false);
    }
  }
}
