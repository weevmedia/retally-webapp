/** A Firebase Auth account as the console sees it (from `adminListUsers`). */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  /** Firebase provider ids: google.com, apple.com, password, … (empty for guests). */
  providers: string[];
  anonymous: boolean;
  disabled: boolean;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  receiptCount: number | null;
  lastReceiptAt: string | null;
}

export type UserTab = 'app' | 'admin';
export type StatusFilter = 'all' | 'enabled' | 'disabled';
export type SignInFilter = 'all' | 'google.com' | 'apple.com' | 'password' | 'guest';
export type ActivityFilter = 'all' | '7d' | '30d' | 'inactive90';

export interface UserFilters {
  text: string;
  status: StatusFilter;
  signIn: SignInFilter;
  activity: ActivityFilter;
}

export const DEFAULT_USER_FILTERS: UserFilters = { text: '', status: 'all', signIn: 'all', activity: 'all' };

export const SIGN_IN_OPTIONS: readonly { id: SignInFilter; label: string }[] = [
  { id: 'all', label: 'Any sign-in' },
  { id: 'google.com', label: 'Google' },
  { id: 'apple.com', label: 'Apple' },
  { id: 'password', label: 'Email & password' },
  { id: 'guest', label: 'Guest' },
];

const PROVIDER_LABELS: Record<string, string> = {
  'google.com': 'Google', 'apple.com': 'Apple', password: 'Email', phone: 'Phone',
  'microsoft.com': 'Microsoft', 'facebook.com': 'Facebook', 'github.com': 'GitHub',
};

export function providerLabels(u: Pick<AppUser, 'providers' | 'anonymous' | 'email'>): string[] {
  if (u.anonymous) return ['Guest'];
  if (u.providers.length === 0) return ['Invited']; // has an email, hasn't set a password yet
  return u.providers.map((p) => PROVIDER_LABELS[p] ?? p);
}

/** Name to show: display name, else email, else "Guest ·" + short uid. */
export function userLabel(u: Pick<AppUser, 'displayName' | 'email' | 'uid'>): string {
  return u.displayName || u.email || `Guest · ${u.uid.slice(0, 6)}`;
}

const DAY = 86_400_000;

function ageDays(iso: string | null, now: number): number {
  if (!iso) return Infinity;
  return (now - new Date(iso).getTime()) / DAY;
}

export function matchesUser(u: AppUser, f: UserFilters, now = Date.now()): boolean {
  if (f.status === 'enabled' && u.disabled) return false;
  if (f.status === 'disabled' && !u.disabled) return false;
  if (f.signIn === 'guest' && !u.anonymous) return false;
  if (f.signIn !== 'all' && f.signIn !== 'guest' && !u.providers.includes(f.signIn)) return false;
  const active = ageDays(u.lastActiveAt, now);
  if (f.activity === '7d' && active > 7) return false;
  if (f.activity === '30d' && active > 30) return false;
  if (f.activity === 'inactive90' && active <= 90) return false;
  const q = f.text.trim().toLowerCase();
  if (q) {
    const hay = [u.email ?? '', u.displayName ?? '', u.uid].join(' ').toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export interface UserStats {
  total: number;
  active30: number;
  disabled: number;
  guests: number;
}

export function statsOf(users: readonly AppUser[], now = Date.now()): UserStats {
  return {
    total: users.length,
    active30: users.filter((u) => ageDays(u.lastActiveAt, now) <= 30).length,
    disabled: users.filter((u) => u.disabled).length,
    guests: users.filter((u) => u.anonymous).length,
  };
}
