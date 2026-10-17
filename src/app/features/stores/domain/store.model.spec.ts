import { describe, expect, it } from 'vitest';
import { normalizeAliases, storeKeyOf } from './store.model';

describe('storeKeyOf', () => {
  it('matches the mobile app normalisation', () => {
    expect(storeKeyOf("Trader Joe's #552")).toBe('traderjoes');
    expect(storeKeyOf('Walmart Supercenter')).toBe('walmart');
    expect(storeKeyOf('7-Eleven')).toBe('7eleven');
    expect(storeKeyOf('Whole Foods Market')).toBe('whole');
    expect(storeKeyOf('   ')).toBe('unknown');
  });
});

describe('normalizeAliases', () => {
  it('trims and removes duplicates case-insensitively', () => {
    expect(normalizeAliases([' WM SUPERCENTER ', 'wm supercenter', '', 'Wal-Mart'])).toEqual([
      'WM SUPERCENTER',
      'Wal-Mart',
    ]);
  });
});
