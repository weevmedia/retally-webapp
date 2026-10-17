import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReceiptQuery, ReceiptRepository } from '../data-access/receipt.repository';
import { ReceiptRow, ReceiptSearchResult } from '../domain/receipt.model';
import { ReceiptsStore } from '../state/receipts.store';
import { ReceiptsListPage } from './receipts-list.page';

const row: ReceiptRow = {
  uid: 'u1', id: 'r1', email: 'pat@example.com', storeName: 'Costco', merchantId: null,
  purchaseDate: '2026-10-10T15:00:00.000Z', purchaseDateLocal: '2026-10-10', currency: 'USD',
  subtotal: 90, tax: 10, total: 100, lineItemCount: 12, paymentMethod: 'card', source: 'scan',
  duplicateCount: 1, overchargeAmount: 4.99, flags: ['price_mismatch'], confidence: 0.95,
  categories: ['grocery'], hasImage: true, deleted: false, createdAt: null,
};
const result: ReceiptSearchResult = {
  rows: [row], total: 1, scanned: 1, truncated: false, userNotFound: false,
  summary: { count: 1, users: 1, stores: 1, items: 12, spentByCurrency: { USD: 100 }, overchargeByCurrency: { USD: 4.99 },
             withDuplicates: 1, withIssues: 1, deleted: 0, undated: 0 },
  facets: { sources: ['scan'], paymentMethods: ['card'], currencies: ['USD'], categories: ['grocery'], flags: ['price_mismatch'] },
};

function setup(query = '') {
  const search = vi.fn(async (_q: ReceiptQuery) => result);
  const repo: Partial<ReceiptRepository> = { search, get: vi.fn(), imageUrl: vi.fn() };
  TestBed.configureTestingModule({
    imports: [ReceiptsListPage],
    providers: [
      provideRouter([{ path: 'receipts', component: ReceiptsListPage }]),
      { provide: ReceiptRepository, useValue: repo },
      ReceiptsStore,
    ],
  });
  if (query) history.replaceState({}, '', `/receipts?${query}`);
  const fixture = TestBed.createComponent(ReceiptsListPage);
  return { fixture, search };
}

const settle = async (fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) => {
  await new Promise((r) => setTimeout(r, 400)); // filter debounce
  await fixture.whenStable();
  fixture.detectChanges();
};

describe('ReceiptsListPage', () => {
  it('searches on load with the default filters and renders rows + summary', async () => {
    const { fixture, search } = setup();
    await settle(fixture);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].filters.preset).toBe('all');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Costco');
    expect(text).toContain('pat@example.com');
    expect(text).toContain('$100.00');
    expect(text).toContain('Overcharge caught');
  });

  it('sends changed filters to the backend and shows them as chips', async () => {
    const { fixture, search } = setup();
    await settle(fixture);
    const page = fixture.componentInstance as unknown as { form: { patchValue(v: object): void } };
    page.form.patchValue({ text: 'milk', minTotal: 20, issues: ['duplicates'], status: 'all' });
    await settle(fixture);
    const last = search.mock.calls.at(-1)![0];
    expect(last.filters).toMatchObject({ text: 'milk', minTotal: 20, issues: ['duplicates'], status: 'all' });
    expect(last.page).toBe(0);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Search: "milk"');
    expect(text).toContain('Issues: Duplicate items');
    expect(text).toContain('Including deleted');
  });

  it('passes sort and paging through', async () => {
    const { fixture, search } = setup();
    await settle(fixture);
    const store = TestBed.inject(ReceiptsStore);
    store.setSort('total', 'asc');
    store.setPage(2, 50);
    await settle(fixture);
    expect(search.mock.calls.at(-1)![0]).toMatchObject({ sortField: 'total', sortDir: 'asc', page: 0, pageSize: 50 });
  });
});
