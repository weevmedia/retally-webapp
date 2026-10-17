import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Timestamp, doc, onSnapshot } from 'firebase/firestore';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { CallableApi } from '@core/api/callable';
import { AppError } from '@core/errors/app-error';
import { CategoryList, DEFAULT_CATEGORIES, ItemCategory } from '../domain/category.model';

/** Port for the item-category list (one document, saved as a whole). */
export abstract class CategoryRepository {
  abstract watch(): Observable<CategoryList>;
  /** Replaces the whole list; order is preserved (first = default). */
  abstract save(categories: ItemCategory[]): Promise<void>;
}

/** Reads `config/itemCategories` directly (admin rule); writes via `adminSaveCategories`. */
@Injectable()
export class FirestoreCategoryRepository extends CategoryRepository {
  private readonly db = inject(FIRESTORE);
  private readonly api = inject(CallableApi);

  watch(): Observable<CategoryList> {
    return new Observable<CategoryList>((subscriber) =>
      onSnapshot(
        doc(this.db, 'config', 'itemCategories'),
        (snap) => subscriber.next(toList(snap.exists() ? snap.data() : null)),
        (error) => subscriber.error(AppError.from(error)),
      ),
    );
  }

  async save(categories: ItemCategory[]): Promise<void> {
    await this.api.call('adminSaveCategories', { categories });
  }
}

function toList(data: Record<string, unknown> | null): CategoryList {
  const raw = Array.isArray(data?.['categories']) ? (data!['categories'] as unknown[]) : [];
  const categories = raw
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      id: String(c['id'] ?? '').trim(),
      name: String(c['name'] ?? '').trim(),
      keywords: Array.isArray(c['keywords']) ? c['keywords'].filter((k): k is string => typeof k === 'string') : [],
    }))
    .filter((c) => c.id && c.name);
  const ts = data?.['updatedAt'];
  return {
    categories: categories.length ? categories : DEFAULT_CATEGORIES.map((c) => ({ ...c, keywords: [...c.keywords] })),
    updatedAt: ts instanceof Timestamp ? ts.toDate() : null,
    updatedBy: typeof data?.['updatedBy'] === 'string' ? (data['updatedBy'] as string) : null,
    isDefault: categories.length === 0,
  };
}
