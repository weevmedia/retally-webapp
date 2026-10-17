import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppError } from '@core/errors/app-error';
import { NotificationService } from '@core/notifications/notification.service';
import { Store, StoreDraft } from '../domain/store.model';
import { StoreRepository } from '../data-access/store.repository';

/**
 * Feature state for Stores (signal-based facade). Pages read signals and call intent methods;
 * only this class talks to the repository. Provided at the route level, so state lives exactly
 * as long as the Stores section is open.
 */
@Injectable()
export class StoresStore {
  private readonly repository = inject(StoreRepository);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _stores = signal<Store[]>([]);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _filter = signal('');
  private readonly _onlyNew = signal(false);
  private readonly _discovering = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly onlyNew = this._onlyNew.asReadonly();
  readonly discovering = this._discovering.asReadonly();
  readonly newCount = computed(() => this._stores().filter((s) => s.status === 'new').length);
  /** Reviewed stores, for "Map to existing". */
  readonly activeStores = computed(() => this._stores().filter((s) => s.status !== 'new'));
  readonly total = computed(() => this._stores().length);
  readonly withoutLogo = computed(() => this._stores().filter((s) => !s.iconUrl).length);

  /** Stores matching the search box (name, key or any alias). */
  readonly visible = computed(() => {
    const q = this._filter().trim().toLowerCase();
    const all = this._onlyNew() ? this._stores().filter((s) => s.status === 'new') : this._stores();
    if (!q) return all;
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.key.includes(q) ||
        s.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  });

  constructor() {
    this.repository
      .watchAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stores) => {
          this._stores.set(stores);
          this._loading.set(false);
          this._error.set(null);
        },
        error: (e: unknown) => {
          this._loading.set(false);
          this._error.set(AppError.from(e).message);
        },
      });
  }

  setFilter(value: string): void {
    this._filter.set(value);
  }

  setOnlyNew(value: boolean): void {
    this._onlyNew.set(value);
  }

  async merge(from: Store, into: Store): Promise<boolean> {
    this._saving.set(true);
    try {
      await this.repository.merge(from.key, into.key);
      this.notifications.success(`"${from.name}" now maps to ${into.name}`);
      return true;
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async discover(): Promise<void> {
    this._discovering.set(true);
    try {
      const r = await this.repository.discover();
      this.notifications.success(
        `Checked ${r.scanned} receipts: ${r.created} new store${r.created === 1 ? '' : 's'} to review` +
          (r.truncated ? ' (stopped at the scan limit)' : ''),
      );
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
    } finally {
      this._discovering.set(false);
    }
  }

  exists(key: string): boolean {
    return this._stores().some((s) => s.key === key);
  }

  /** Saves a store, uploading a new logo first when one was picked. Returns true on success. */
  async save(draft: StoreDraft, isNew: boolean, logo: File | null): Promise<boolean> {
    this._saving.set(true);
    try {
      const iconUrl = logo ? await this.repository.uploadLogo(draft.key, logo) : draft.iconUrl;
      await this.repository.save({ ...draft, iconUrl }, isNew);
      this.notifications.success(`${draft.name} ${isNew ? 'added' : 'saved'}`);
      return true;
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async remove(store: Store): Promise<void> {
    try {
      await this.repository.remove(store.key);
      this.notifications.success(`${store.name} deleted`);
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
    }
  }
}
