import { describe, expect, it } from 'vitest';
import { DEFAULT_CATEGORIES, categoryIdOf, isBuiltIn, keywordConflicts, move, normalizeKeywords, withBuiltIns } from './category.model';

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

  it('adds missing built-in (AI) categories after the saved ones', () => {
    const list = withBuiltIns([{ id: 'snacks', name: 'Snacks', keywords: ['chips'] }, { id: 'grocery', name: 'Food', keywords: [] }]);
    expect(list[0].id).toBe('snacks');
    expect(list[1]).toEqual({ id: 'grocery', name: 'Food', keywords: [] });
    expect(list.length).toBe(1 + DEFAULT_CATEGORIES.length);
    expect(isBuiltIn('household')).toBe(true);
    expect(isBuiltIn('snacks')).toBe(false);
  });
});
