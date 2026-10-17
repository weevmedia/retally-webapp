import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FIREBASE_STORAGE, FIRESTORE } from '@core/firebase/firebase.providers';
import { CallableApi } from '@core/api/callable';
import { AppError } from '@core/errors/app-error';
import { Store, StoreCategory, StoreDraft } from '../domain/store.model';

/**
 * Port for store master data. Pages and state depend on this abstraction, not on Firestore,
 * so the backing store (Firestore today, a published JSON or another DB later) can change
 * without touching UI code, and specs can provide an in-memory fake.
 */
export abstract class StoreRepository {
  /** Live list of all stores, ordered by name. */
  abstract watchAll(): Observable<Store[]>;
  abstract save(draft: StoreDraft, isNew: boolean): Promise<void>;
  abstract remove(key: string): Promise<void>;
  /** Uploads a logo for [key] and returns its public download URL. */
  abstract uploadLogo(key: string, file: File): Promise<string>;
  /** Folds [fromKey] into [intoKey]: its names become aliases, then it's deleted. */
  abstract merge(fromKey: string, intoKey: string): Promise<void>;
  /** Scans every receipt and adds stores that aren't in the table yet (as `new`). */
  abstract discover(): Promise<DiscoverResult>;
}

export interface DiscoverResult {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  truncated: boolean;
}

const COLLECTION = 'store_icons';
const MAX_LOGO_BYTES = 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** Firestore + Storage adapter. Reads directly (rules: admins only); writes via admin functions. */
@Injectable()
export class FirestoreStoreRepository extends StoreRepository {
  private readonly db = inject(FIRESTORE);
  private readonly storage = inject(FIREBASE_STORAGE);
  private readonly api = inject(CallableApi);

  watchAll(): Observable<Store[]> {
    return new Observable<Store[]>((subscriber) =>
      onSnapshot(
        query(collection(this.db, COLLECTION), orderBy('name')),
        (snap) => subscriber.next(snap.docs.map((d) => toStore(d.id, d.data()))),
        (error) => subscriber.error(AppError.from(error)),
      ),
    );
  }

  async save(draft: StoreDraft, isNew: boolean): Promise<void> {
    await this.api.call('adminUpsertStore', { ...draft, isNew });
  }

  async remove(key: string): Promise<void> {
    await this.api.call('adminDeleteStore', { key });
  }

  async merge(fromKey: string, intoKey: string): Promise<void> {
    await this.api.call('adminMergeStore', { fromKey, intoKey });
  }

  discover(): Promise<DiscoverResult> {
    return this.api.call('adminDiscoverStores', {});
  }

  async uploadLogo(key: string, file: File): Promise<string> {
    if (!LOGO_TYPES.includes(file.type)) throw new AppError('Logo must be PNG, JPEG, WebP or SVG.', 'invalid-file');
    if (file.size > MAX_LOGO_BYTES) throw new AppError('Logo must be under 1 MB.', 'invalid-file');
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1].replace('jpeg', 'jpg');
    // Path the mobile app's set-up notes already use: store-icons/<key>.<ext>
    const objectRef = ref(this.storage, `store-icons/${key}.${ext}`);
    try {
      await uploadBytes(objectRef, file, { contentType: file.type, cacheControl: 'public,max-age=86400' });
      return await getDownloadURL(objectRef);
    } catch (e) {
      throw AppError.from(e);
    }
  }
}

function toStore(key: string, data: Record<string, unknown>): Store {
  const ts = data['updatedAt'];
  const stats = (data['stats'] ?? {}) as Record<string, unknown>;
  const lastSeen = stats['lastSeenAt'];
  return {
    key,
    name: typeof data['name'] === 'string' ? data['name'] : key,
    iconUrl: typeof data['iconUrl'] === 'string' ? data['iconUrl'] : '',
    aliases: Array.isArray(data['aliases']) ? data['aliases'].filter((a): a is string => typeof a === 'string') : [],
    category: typeof data['category'] === 'string' ? (data['category'] as StoreCategory) : null,
    status: data['status'] === 'new' ? 'new' : 'active',
    receiptCount: typeof stats['receiptCount'] === 'number' ? Math.max(0, stats['receiptCount']) : null,
    lastSeenAt: lastSeen instanceof Timestamp ? lastSeen.toDate() : null,
    updatedAt: ts instanceof Timestamp ? ts.toDate() : null,
    updatedBy: typeof data['updatedBy'] === 'string' ? data['updatedBy'] : null,
  };
}
