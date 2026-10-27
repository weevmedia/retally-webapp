/**
 * Store master record — one document in Firestore `store_icons/{key}`.
 *
 * The mobile app resolves a receipt's store name to [key] with `iconKeyOf` and shows
 * [iconUrl] as the store logo (served by the `getStoreIcons` function). [aliases] are
 * extra printed names ("WM SUPERCENTER", "WAL-MART #1234") that should map to this store.
 */
export interface Store {
  key: string;
  name: string;
  iconUrl: string;
  /** Weekly-ad page opened when a user taps this store in their favourites ('' = none). */
  weeklyAdUrl: string;
  aliases: string[];
  category: StoreCategory | null;
  /** `new` = created automatically from a receipt, waiting for an admin to review. */
  status: StoreStatus;
  /** Receipts that mention this store (kept by the backend; null on older records). */
  receiptCount: number | null;
  lastSeenAt: Date | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export type StoreStatus = 'new' | 'active';

/** Review queue first (most-seen first), then everything else. */
export function compareForReview(a: Store, b: Store): number {
  if (a.status !== b.status) return a.status === 'new' ? -1 : 1;
  if (a.status === 'new') return (b.receiptCount ?? 0) - (a.receiptCount ?? 0);
  return 0;
}

/** What the form edits; the server stamps updatedAt / updatedBy. */
export type StoreDraft = Pick<Store, 'key' | 'name' | 'iconUrl' | 'weeklyAdUrl' | 'aliases' | 'category'>;

export const STORE_CATEGORIES = [
  'grocery', 'warehouse', 'pharmacy', 'department', 'convenience', 'specialty', 'other',
] as const;
export type StoreCategory = (typeof STORE_CATEGORIES)[number];

const SUFFIXES = new Set([
  'supercenter', 'supermarket', 'wholesale', 'market', 'markets',
  'store', 'stores', 'grocery', 'groceries', 'foods', 'food',
]);

/**
 * Same normalisation as the app's `iconKeyOf` (shared/.../domain/store/StoreIcon.kt) —
 * keep the two in sync, or logos stop matching. "Trader Joe's #552" → "traderjoes".
 */
export function storeKeyOf(storeName: string): string {
  const key = storeName
    .toLowerCase()
    .replace(/#\d+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !SUFFIXES.has(w))
    .join('');
  return key || 'unknown';
}

/** Trims, drops empties and case-insensitive duplicates. */
export function normalizeAliases(aliases: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of aliases) {
    const alias = raw.trim();
    const k = alias.toLowerCase();
    if (alias && !seen.has(k)) {
      seen.add(k);
      out.push(alias);
    }
  }
  return out;
}
