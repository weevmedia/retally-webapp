/**
 * Receipts as the admin console sees them. The rows come from the `adminSearchReceipts` function
 * (receipts are owner-only in Firestore), which applies these filters server-side.
 */
export interface ReceiptRow {
  uid: string;
  id: string;
  email: string | null;
  storeName: string;
  merchantId: string | null;
  purchaseDate: string | null;
  purchaseDateLocal: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  lineItemCount: number;
  paymentMethod: string;
  source: string;
  duplicateCount: number;
  overchargeAmount: number;
  flags: string[];
  confidence: number | null;
  categories: string[];
  hasImage: boolean;
  deleted: boolean;
  createdAt: string | null;
}

export type ReceiptStatus = 'active' | 'deleted' | 'all';
export type ImageFilter = 'any' | 'yes' | 'no';
export type SortField = 'date' | 'total' | 'store' | 'items' | 'overcharge' | 'user';
export type SortDir = 'asc' | 'desc';

export const DATE_PRESETS = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'ytd', label: 'Year to date' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom range' },
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number]['id'];

export interface ReceiptFilters {
  preset: DatePreset;
  /** YYYY-MM-DD, only used when preset is 'custom'. */
  from: string;
  to: string;
  text: string;
  searchOcr: boolean;
  /** Email or uid. */
  user: string;
  store: string;
  minTotal: number | null;
  maxTotal: number | null;
  minItems: number | null;
  maxItems: number | null;
  sources: string[];
  paymentMethods: string[];
  currencies: string[];
  categories: string[];
  issues: string[];
  status: ReceiptStatus;
  hasImage: ImageFilter;
}

export const DEFAULT_FILTERS: ReceiptFilters = {
  preset: 'all', from: '', to: '', text: '', searchOcr: false, user: '', store: '',
  minTotal: null, maxTotal: null, minItems: null, maxItems: null,
  sources: [], paymentMethods: [], currencies: [], categories: [], issues: [],
  status: 'active', hasImage: 'any',
};

/** Issue filters; the flag ids match `analysis.flags` written by the app. */
export const ISSUES: readonly { id: string; label: string }[] = [
  { id: 'duplicates', label: 'Duplicate items' },
  { id: 'overcharge', label: 'Overcharge caught' },
  { id: 'price_mismatch', label: 'Price mismatch' },
  { id: 'total_mismatch', label: 'Total mismatch' },
  { id: 'tax_anomaly', label: 'Tax anomaly' },
  { id: 'low_confidence', label: 'Low scan confidence' },
  { id: 'no_items', label: 'No line items' },
];

export interface ReceiptSummary {
  count: number;
  users: number;
  stores: number;
  items: number;
  spentByCurrency: Record<string, number>;
  overchargeByCurrency: Record<string, number>;
  withDuplicates: number;
  withIssues: number;
  deleted: number;
  /** Receipts with no usable date (only shown when no date range is set). */
  undated: number;
}

export interface ReceiptFacets {
  sources: string[];
  paymentMethods: string[];
  currencies: string[];
  categories: string[];
  flags: string[];
}

export interface ReceiptSearchResult {
  rows: ReceiptRow[];
  total: number;
  scanned: number;
  truncated: boolean;
  summary: ReceiptSummary;
  facets: ReceiptFacets;
  userNotFound: boolean;
}

export interface LineItem {
  id: string;
  position?: number;
  rawDescription?: string;
  normalizedName?: string;
  category?: string;
  brand?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  discount?: number;
  isDuplicate?: boolean;
  userCorrected?: boolean;
  /** The shopper picked [category] by hand in the app (AI never changes it). */
  categoryCorrected?: boolean;
  [key: string]: unknown;
}

export interface ReceiptDetail {
  /** Storage path of the photo (recorded on the receipt, or found in Storage by receipt id). */
  imagePath: string | null;
  /** Ready-to-load URL when the backend could build one; otherwise resolve imagePath client-side. */
  imageUrl: string | null;
  uid: string;
  id: string;
  email: string | null;
  anonymous: boolean | null;
  receipt: Record<string, unknown>;
  lineItems: LineItem[];
}

// ---------- dates ----------

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysAgo(today: Date, days: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
}

/** Date range for a filter set, as inclusive YYYY-MM-DD strings (null = open-ended). */
export function dateRange(f: Pick<ReceiptFilters, 'preset' | 'from' | 'to'>, today = new Date()): { from: string | null; to: string | null } {
  const t = ymd(today);
  switch (f.preset) {
    case '7d': return { from: ymd(daysAgo(today, 6)), to: t };
    case '30d': return { from: ymd(daysAgo(today, 29)), to: t };
    case '90d': return { from: ymd(daysAgo(today, 89)), to: t };
    case 'month': return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: t };
    case 'lastMonth':
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'ytd': return { from: ymd(new Date(today.getFullYear(), 0, 1)), to: t };
    case '12m': return { from: ymd(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)), to: t };
    case 'custom': return { from: f.from || null, to: f.to || null };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

// ---------- URL <-> filters (so a filtered view can be bookmarked or shared) ----------

const LIST_KEYS = ['sources', 'paymentMethods', 'currencies', 'categories', 'issues'] as const;
const NUM_KEYS = ['minTotal', 'maxTotal', 'minItems', 'maxItems'] as const;
const STR_KEYS = ['from', 'to', 'text', 'user', 'store'] as const;

export function filtersToParams(f: ReceiptFilters): Record<string, string | null> {
  const p: Record<string, string | null> = {};
  p['preset'] = f.preset === DEFAULT_FILTERS.preset ? null : f.preset;
  for (const k of STR_KEYS) p[k] = f[k] ? f[k] : null;
  if (f.preset !== 'custom') { p['from'] = null; p['to'] = null; }
  for (const k of NUM_KEYS) p[k] = f[k] === null ? null : String(f[k]);
  for (const k of LIST_KEYS) p[k] = f[k].length ? f[k].join(',') : null;
  p['ocr'] = f.searchOcr ? '1' : null;
  p['status'] = f.status === 'active' ? null : f.status;
  p['image'] = f.hasImage === 'any' ? null : f.hasImage;
  return p;
}

export function filtersFromParams(get: (key: string) => string | null): ReceiptFilters {
  const f: ReceiptFilters = { ...DEFAULT_FILTERS };
  const preset = get('preset');
  if (preset && DATE_PRESETS.some((d) => d.id === preset)) f.preset = preset as DatePreset;
  for (const k of STR_KEYS) f[k] = get(k) ?? '';
  for (const k of NUM_KEYS) {
    const v = get(k);
    f[k] = v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  }
  for (const k of LIST_KEYS) f[k] = (get(k) ?? '').split(',').filter(Boolean);
  f.searchOcr = get('ocr') === '1';
  const status = get('status');
  f.status = status === 'deleted' || status === 'all' ? status : 'active';
  const image = get('image');
  f.hasImage = image === 'yes' || image === 'no' ? image : 'any';
  return f;
}

/** How many filters differ from the defaults (shown on the "More filters" button). */
export function activeFilterCount(f: ReceiptFilters): number {
  let n = 0;
  for (const k of ['text', 'user', 'store'] as const) if (f[k]) n++;
  for (const k of NUM_KEYS) if (f[k] !== null) n++;
  for (const k of LIST_KEYS) if (f[k].length) n++;
  if (f.status !== 'active') n++;
  if (f.hasImage !== 'any') n++;
  if (f.preset !== DEFAULT_FILTERS.preset) n++;
  return n;
}

// ---------- labels & export ----------

export function humanize(id: string): string {
  return id.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function issueLabel(id: string): string {
  return ISSUES.find((i) => i.id === id)?.label ?? humanize(id);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly ReceiptRow[]): string {
  const header = [
    'date', 'store', 'user_email', 'user_id', 'receipt_id', 'currency', 'subtotal', 'tax', 'total', 'items',
    'payment', 'source', 'duplicates', 'overcharge', 'flags', 'confidence', 'categories', 'has_image', 'deleted',
  ];
  const lines = rows.map((r) =>
    [
      r.purchaseDateLocal, r.storeName, r.email, r.uid, r.id, r.currency, r.subtotal, r.tax, r.total, r.lineItemCount,
      r.paymentMethod, r.source, r.duplicateCount, r.overchargeAmount, r.flags.join('|'), r.confidence ?? '',
      r.categories.join('|'), r.hasImage, r.deleted,
    ].map(csvCell).join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
