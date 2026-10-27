import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { collection, onSnapshot } from 'firebase/firestore';
import { FIRESTORE } from '@core/firebase/firebase.providers';
import { storeKeyOf } from '@features/stores/domain/store.model';

/**
 * Store logos for any screen that shows a receipt's store (receipts list, receipt detail).
 *
 * Listens to `store_icons` live, so a logo added or changed on the Stores page shows up
 * everywhere straight away — no reload. A printed store name resolves the same way the backend
 * does it (`loadStoreKeyIndex`): the document id, the store's display name, or any alias,
 * all normalised with `storeKeyOf` ("PATEL BROS #12" → an alias of Patel Brothers).
 *
 * The listener starts on first use and lives as long as the app (one small collection).
 */
@Injectable({ providedIn: 'root' })
export class StoreLogoService {
  private readonly db = inject(FIRESTORE);
  private readonly urlByKey = signal<ReadonlyMap<string, string>>(new Map());
  private started = false;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.unsubscribe?.());
  }

  /**
   * Logo URL for a printed store name, or '' when the store has none (yet). Reads a signal,
   * so a `computed` / template calling it updates when logos change.
   */
  urlFor(storeName: string | null | undefined): string {
    return this.urlByKey().get(storeKeyOf(storeName ?? '')) ?? '';
  }

  /** Starts the live `store_icons` listener (idempotent). Call outside any `computed`. */
  ensureListening(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribe = onSnapshot(
      collection(this.db, 'store_icons'),
      (snap) => {
        const byKey = new Map<string, string>();
        for (const doc of snap.docs) {
          const data = doc.data();
          const iconUrl = typeof data['iconUrl'] === 'string' ? data['iconUrl'].trim() : '';
          if (!iconUrl) continue;
          const keys = [storeKeyOf(doc.id), doc.id];
          if (typeof data['name'] === 'string') keys.push(storeKeyOf(data['name']));
          if (Array.isArray(data['aliases'])) {
            for (const a of data['aliases']) if (typeof a === 'string') keys.push(storeKeyOf(a));
          }
          // First store to claim a key wins, like the backend index.
          for (const k of keys) if (!byKey.has(k)) byKey.set(k, iconUrl);
        }
        this.urlByKey.set(byKey);
      },
      (error) => console.error('[StoreLogoService] store_icons listener failed', error),
    );
  }
}
