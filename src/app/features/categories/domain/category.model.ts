/**
 * Item categories — the list in Firestore `config/itemCategories` that the app auto-tags
 * receipt line items with (served by the `getCategories` function).
 *
 * Order matters: the FIRST category is the app's default, where items matching no keyword land.
 * `id` is what receipts store (`lineItems.category`, `categoryTotals`), so it never changes once
 * created; `name` is just the label.
 */
export interface ItemCategory {
  id: string;
  name: string;
  keywords: string[];
}

export interface CategoryList {
  categories: ItemCategory[];
  updatedAt: Date | null;
  updatedBy: string | null;
  /** True when the doc doesn't exist yet and the app is using its bundled defaults. */
  isDefault: boolean;
}

/** What `getCategories` returns when the doc is missing — keep in sync with the backend. */
export const DEFAULT_CATEGORIES: readonly ItemCategory[] = [
  { id: 'grocery', name: 'Grocery', keywords: [] },
  { id: 'misc', name: 'Miscellaneous', keywords: [] },
];

export const MAX_CATEGORIES = 50;
export const MAX_KEYWORDS = 200;

/** "Health & Beauty" → "health_beauty". Same alphabet the backend accepts: a-z 0-9 _ -. */
export function categoryIdOf(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/**
 * Splits pasted text on commas / new lines, lower-cases, trims and de-duplicates — the same
 * normalisation the server applies, so what you see is what gets saved.
 */
export function normalizeKeywords(input: readonly string[]): string[] {
  const out = new Set<string>();
  for (const chunk of input) {
    for (const raw of chunk.split(/[,\n]/)) {
      const k = raw.trim().toLowerCase().slice(0, 80);
      if (k) out.add(k);
    }
  }
  return [...out];
}

/** Keywords that appear in more than one category: keyword → the category names using it. */
export function keywordConflicts(categories: readonly ItemCategory[]): Map<string, string[]> {
  const owners = new Map<string, string[]>();
  for (const c of categories) {
    for (const k of c.keywords) owners.set(k, [...(owners.get(k) ?? []), c.name]);
  }
  return new Map([...owners].filter(([, names]) => names.length > 1));
}

/** Moves the item at [from] to [to] (both clamped), returning a new array. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  const target = Math.max(0, Math.min(copy.length - 1, to));
  const [item] = copy.splice(from, 1);
  copy.splice(target, 0, item);
  return copy;
}
