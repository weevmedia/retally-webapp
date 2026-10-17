import { Injectable, inject } from '@angular/core';
import { getDownloadURL, ref } from 'firebase/storage';
import { FIREBASE_STORAGE } from '@core/firebase/firebase.providers';
import { CallableApi } from '@core/api/callable';
import { ReceiptDetail, ReceiptFilters, ReceiptSearchResult, SortDir, SortField, dateRange } from '../domain/receipt.model';

export interface ReceiptQuery {
  filters: ReceiptFilters;
  sortField: SortField;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

/** Port for receipts (read-only in the console). */
export abstract class ReceiptRepository {
  abstract search(query: ReceiptQuery): Promise<ReceiptSearchResult>;
  abstract get(uid: string, receiptId: string): Promise<ReceiptDetail>;
  /** Download URL for a receipt photo (Storage rules allow admins to read). */
  abstract imageUrl(storagePath: string): Promise<string>;
}

/** Calls the admin functions; receipts are owner-only in Firestore, so there are no direct reads. */
@Injectable()
export class CallableReceiptRepository extends ReceiptRepository {
  private readonly api = inject(CallableApi);
  private readonly storage = inject(FIREBASE_STORAGE);

  search(q: ReceiptQuery): Promise<ReceiptSearchResult> {
    const { from, to } = dateRange(q.filters);
    const { preset: _preset, from: _f, to: _t, ...rest } = q.filters;
    return this.api.call('adminSearchReceipts', {
      filters: { ...rest, from, to },
      sortField: q.sortField,
      sortDir: q.sortDir,
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  get(uid: string, receiptId: string): Promise<ReceiptDetail> {
    return this.api.call('adminGetReceipt', { uid, receiptId });
  }

  imageUrl(storagePath: string): Promise<string> {
    return getDownloadURL(ref(this.storage, storagePath));
  }
}
