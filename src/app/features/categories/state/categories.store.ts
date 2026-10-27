import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppError } from '@core/errors/app-error';
import { NotificationService } from '@core/notifications/notification.service';
import { CategoryList, ItemCategory, isBuiltIn, keywordConflicts, move } from '../domain/category.model';
import { CategoryRepository } from '../data-access/category.repository';

/**
 * Feature state for item categories. Every intent builds the next full list and saves it in one
 * call (the list is a single document), so there is no half-saved state.
 */
@Injectable()
export class CategoriesStore {
  private readonly repository = inject(CategoryRepository);
  private readonly notifications = inject(NotificationService);

  private readonly _list = signal<CategoryList | null>(null);
  private readonly _error = signal<string | null>(null);
  private readonly _saving = signal(false);
  private readonly _filter = signal('');

  readonly loading = computed(() => this._list() === null && this._error() === null);
  readonly error = this._error.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly categories = computed(() => this._list()?.categories ?? []);
  readonly isDefault = computed(() => this._list()?.isDefault ?? false);
  readonly updatedAt = computed(() => this._list()?.updatedAt ?? null);
  readonly updatedBy = computed(() => this._list()?.updatedBy ?? null);
  readonly keywordCount = computed(() => this.categories().reduce((n, c) => n + c.keywords.length, 0));
  readonly conflicts = computed(() => keywordConflicts(this.categories()));

  /** Categories matching the search box (name, id or any keyword), keeping their position. */
  readonly visible = computed(() => {
    const q = this._filter().trim().toLowerCase();
    const all = this.categories().map((category, index) => ({ category, index }));
    if (!q) return all;
    return all.filter(
      ({ category: c }) => c.name.toLowerCase().includes(q) || c.id.includes(q) || c.keywords.some((k) => k.includes(q)),
    );
  });

  constructor() {
    this.repository
      .watch()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({
        next: (list) => {
          this._list.set(list);
          this._error.set(null);
        },
        error: (e: unknown) => this._error.set(AppError.from(e).message),
      });
  }

  setFilter(value: string): void {
    this._filter.set(value);
  }

  idTaken(id: string, exceptId: string | null = null): boolean {
    return this.categories().some((c) => c.id === id && c.id !== exceptId);
  }

  nameTaken(name: string, exceptId: string | null = null): boolean {
    const n = name.trim().toLowerCase();
    return this.categories().some((c) => c.name.toLowerCase() === n && c.id !== exceptId);
  }

  /** Adds (originalId null) or replaces a category in place. */
  upsert(category: ItemCategory, originalId: string | null): Promise<boolean> {
    const list = this.categories();
    const next =
      originalId === null ? [...list, category] : list.map((c) => (c.id === originalId ? category : c));
    return this.persist(next, `${category.name} ${originalId === null ? 'added' : 'saved'}`);
  }

  remove(id: string): Promise<boolean> {
    if (isBuiltIn(id)) return Promise.resolve(false); // the AI returns it; the server would add it back
    const target = this.categories().find((c) => c.id === id);
    return this.persist(this.categories().filter((c) => c.id !== id), `${target?.name ?? id} deleted`);
  }

  moveBy(id: string, delta: number): Promise<boolean> {
    const list = this.categories();
    const from = list.findIndex((c) => c.id === id);
    return this.persist(move(list, from, from + delta), 'Order saved');
  }

  private async persist(next: ItemCategory[], successMessage: string): Promise<boolean> {
    this._saving.set(true);
    try {
      await this.repository.save(next);
      this.notifications.success(successMessage);
      return true;
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
      return false;
    } finally {
      this._saving.set(false);
    }
  }
}
