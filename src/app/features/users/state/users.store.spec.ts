import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppUser } from '../domain/user.model';
import { UserRepository } from '../data-access/user.repository';
import { UsersStore } from './users.store';

const u = (over: Partial<AppUser>): AppUser => ({
  uid: 'x', email: null, displayName: null, photoUrl: null, providers: ['google.com'], anonymous: false, disabled: false,
  isAdmin: false, emailVerified: true, createdAt: null, lastSignInAt: null, lastActiveAt: null, receiptCount: 5, lastReceiptAt: null,
  ...over,
});

function setup(repoOver: Partial<UserRepository> = {}) {
  const users = [u({ uid: 'a1', email: 'admin@x.com', isAdmin: true }), u({ uid: 'p1', email: 'pat@x.com' }), u({ uid: 'g1', providers: [], anonymous: true })];
  const repo = {
    list: vi.fn(async () => ({ users, truncated: false, you: 'a1' })),
    setDisabled: vi.fn(async (uid: string, disabled: boolean) => u({ ...users.find((x) => x.uid === uid)!, disabled, receiptCount: null })),
    setAdmin: vi.fn(async (uid: string, admin: boolean) => u({ ...users.find((x) => x.uid === uid)!, isAdmin: admin })),
    inviteAdmin: vi.fn(),
    ...repoOver,
  };
  TestBed.configureTestingModule({
    providers: [UsersStore, { provide: UserRepository, useValue: repo }, { provide: MatSnackBar, useValue: { open: vi.fn() } }],
  });
  return { store: TestBed.inject(UsersStore), repo };
}

describe('UsersStore', () => {
  it('splits app users and admins', async () => {
    const { store } = setup();
    await store.load();
    expect(store.appUsers().map((x) => x.uid)).toEqual(['p1', 'g1']);
    expect(store.admins().map((x) => x.uid)).toEqual(['a1']);
    store.setTab('admin');
    expect(store.visible().map((x) => x.uid)).toEqual(['a1']);
    expect(store.you()).toBe('a1');
  });

  it('disables a user in place and keeps receipt stats', async () => {
    const { store, repo } = setup();
    await store.load();
    expect(await store.setDisabled(store.appUsers()[0], true)).toBe(true);
    expect(repo.setDisabled).toHaveBeenCalledWith('p1', true);
    const pat = store.appUsers().find((x) => x.uid === 'p1')!;
    expect(pat.disabled).toBe(true);
    expect(pat.receiptCount).toBe(5);
    store.setFilters({ text: '', status: 'disabled', signIn: 'all', activity: 'all' });
    expect(store.visible().map((x) => x.uid)).toEqual(['p1']);
  });

  it('moves a user between tabs when admin access changes', async () => {
    const { store } = setup();
    await store.load();
    await store.setAdmin(store.appUsers()[0], true);
    expect(store.admins().map((x) => x.uid).sort()).toEqual(['a1', 'p1']);
  });

  it('reports a failed action and leaves the user unchanged', async () => {
    const { store } = setup({ setDisabled: vi.fn(async () => { throw new Error('This is the last enabled admin.'); }) });
    await store.load();
    store.setTab('admin');
    expect(await store.setDisabled(store.admins()[0], true)).toBe(false);
    expect(store.admins()[0].disabled).toBe(false);
  });
});
