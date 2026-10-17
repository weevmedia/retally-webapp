import { describe, expect, it } from 'vitest';
import { AppUser, DEFAULT_USER_FILTERS, matchesUser, providerLabels, statsOf, userLabel } from './user.model';

const now = new Date('2026-10-16T12:00:00Z').getTime();
const base: AppUser = {
  uid: 'abcdef123', email: 'pat@example.com', displayName: null, photoUrl: null, providers: ['google.com'],
  anonymous: false, disabled: false, isAdmin: false, emailVerified: true, createdAt: '2026-01-01T00:00:00Z',
  lastSignInAt: null, lastActiveAt: '2026-10-14T00:00:00Z', receiptCount: 3, lastReceiptAt: null,
};
const guest: AppUser = { ...base, uid: 'zzz999', email: null, providers: [], anonymous: true, lastActiveAt: '2026-05-01T00:00:00Z' };
const off: AppUser = { ...base, uid: 'off1', email: 'off@example.com', providers: ['password'], disabled: true };

describe('user.model', () => {
  it('filters by status, sign-in, activity and text', () => {
    const f = DEFAULT_USER_FILTERS;
    expect(matchesUser(off, { ...f, status: 'enabled' }, now)).toBe(false);
    expect(matchesUser(off, { ...f, status: 'disabled' }, now)).toBe(true);
    expect(matchesUser(guest, { ...f, signIn: 'guest' }, now)).toBe(true);
    expect(matchesUser(base, { ...f, signIn: 'guest' }, now)).toBe(false);
    expect(matchesUser(off, { ...f, signIn: 'password' }, now)).toBe(true);
    expect(matchesUser(base, { ...f, activity: '7d' }, now)).toBe(true);
    expect(matchesUser(guest, { ...f, activity: 'inactive90' }, now)).toBe(true);
    expect(matchesUser(base, { ...f, text: 'PAT example' }, now)).toBe(true);
    expect(matchesUser(base, { ...f, text: 'abcdef' }, now)).toBe(true);
    expect(matchesUser(base, { ...f, text: 'nobody' }, now)).toBe(false);
  });

  it('labels users and providers', () => {
    expect(userLabel(guest)).toBe('Guest · zzz999');
    expect(providerLabels(guest)).toEqual(['Guest']);
    expect(providerLabels({ providers: [], anonymous: false, email: 'new@x.com' })).toEqual(['Invited']);
    expect(providerLabels(base)).toEqual(['Google']);
  });

  it('computes stats', () => {
    expect(statsOf([base, guest, off], now)).toEqual({ total: 3, active30: 2, disabled: 1, guests: 1 });
  });
});
