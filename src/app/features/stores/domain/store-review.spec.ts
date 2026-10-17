import { describe, expect, it } from 'vitest';
import { Store, compareForReview } from './store.model';

const s = (key: string, status: Store['status'], receiptCount: number | null): Store => ({
  key, name: key, iconUrl: '', aliases: [], category: null, status, receiptCount, lastSeenAt: null, updatedAt: null, updatedBy: null,
});

describe('compareForReview', () => {
  it('puts new stores first, most-seen first, and keeps the rest in order', () => {
    const list = [s('a', 'active', 9), s('n1', 'new', 1), s('b', 'active', null), s('n2', 'new', 7)];
    expect([...list].sort(compareForReview).map((x) => x.key)).toEqual(['n2', 'n1', 'a', 'b']);
  });
});
