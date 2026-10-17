import { describe, expect, it } from 'vitest';
import { categoryIdOf, keywordConflicts, move, normalizeKeywords } from './category.model';

describe('category.model', () => {
  it('derives ids from names', () => {
    expect(categoryIdOf('Health & Beauty')).toBe('health_beauty');
    expect(categoryIdOf('  Baby / Kids ')).toBe('baby_kids');
    expect(categoryIdOf('Grocery')).toBe('grocery');
  });

  it('normalizes pasted keywords', () => {
    expect(normalizeKeywords(['Milk, EGGS\nbread', 'milk', '  '])).toEqual(['milk', 'eggs', 'bread']);
  });

  it('finds keywords used by two categories', () => {
    const conflicts = keywordConflicts([
      { id: 'a', name: 'A', keywords: ['soap', 'milk'] },
      { id: 'b', name: 'B', keywords: ['soap'] },
    ]);
    expect([...conflicts]).toEqual([['soap', ['A', 'B']]]);
  });

  it('moves items', () => {
    expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(move(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a']);
  });
});
