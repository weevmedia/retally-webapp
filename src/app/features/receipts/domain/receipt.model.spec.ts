import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS, ReceiptRow, activeFilterCount, dateRange, filtersFromParams, filtersToParams, toCsv,
} from './receipt.model';

const today = new Date(2026, 9, 16); // 16 Oct 2026

describe('dateRange', () => {
  it('handles rolling presets inclusively', () => {
    expect(dateRange({ preset: '7d', from: '', to: '' }, today)).toEqual({ from: '2026-10-10', to: '2026-10-16' });
    expect(dateRange({ preset: '30d', from: '', to: '' }, today)).toEqual({ from: '2026-09-17', to: '2026-10-16' });
  });
  it('handles calendar presets', () => {
    expect(dateRange({ preset: 'month', from: '', to: '' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-16' });
    expect(dateRange({ preset: 'lastMonth', from: '', to: '' }, today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(dateRange({ preset: 'ytd', from: '', to: '' }, today)).toEqual({ from: '2026-01-01', to: '2026-10-16' });
    expect(dateRange({ preset: 'all', from: '', to: '' }, today)).toEqual({ from: null, to: null });
  });
  it('uses custom dates as given', () => {
    expect(dateRange({ preset: 'custom', from: '2026-01-05', to: '' }, today)).toEqual({ from: '2026-01-05', to: null });
  });
});

describe('URL params', () => {
  it('round-trips a full filter set', () => {
    const f = {
      ...DEFAULT_FILTERS, preset: 'custom' as const, from: '2026-01-01', to: '2026-02-01', text: 'milk',
      user: 'a@b.com', minTotal: 10, maxItems: 40, sources: ['scan'], issues: ['duplicates', 'tax_anomaly'],
      status: 'all' as const, hasImage: 'yes' as const, searchOcr: true,
    };
    const params = filtersToParams(f);
    expect(filtersFromParams((k) => params[k] ?? null)).toEqual(f);
  });
  it('leaves defaults out of the URL', () => {
    expect(Object.values(filtersToParams(DEFAULT_FILTERS)).every((v) => v === null)).toBe(true);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });
});

describe('toCsv', () => {
  it('escapes commas and quotes', () => {
    const row = {
      uid: 'u1', id: 'r1', email: null, storeName: 'Joe\'s "Best", Inc', merchantId: null, purchaseDate: null,
      purchaseDateLocal: '2026-10-01', currency: 'USD', subtotal: 1, tax: 0, total: 1, lineItemCount: 1,
      paymentMethod: 'card', source: 'scan', duplicateCount: 0, overchargeAmount: 0, flags: [], confidence: 0.9,
      categories: ['grocery'], hasImage: true, deleted: false, createdAt: null,
    } satisfies ReceiptRow;
    const [, line] = toCsv([row]).split('\n');
    expect(line.startsWith('2026-10-01,"Joe\'s ""Best"", Inc",,u1,r1')).toBe(true);
  });
});
