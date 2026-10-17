import { Injectable, computed, inject, signal } from '@angular/core';
import { AppError } from '@core/errors/app-error';
import { NotificationService } from '@core/notifications/notification.service';
import { AppUser, DEFAULT_USER_FILTERS, UserFilters, UserTab, matchesUser, statsOf, userLabel } from '../domain/user.model';
import { InviteResult, UserRepository } from '../data-access/user.repository';

/** Feature state for Users: one list from Auth, split into app users and admins, filtered locally. */
@Injectable()
export class UsersStore {
  private readonly repository = inject(UserRepository);
  private readonly notifications = inject(NotificationService);

  private readonly _users = signal<AppUser[]>([]);
  private readonly _you = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _loaded = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _truncated = signal(false);
  private readonly _busy = signal<ReadonlySet<string>>(new Set());
  private readonly _tab = signal<UserTab>('app');
  private readonly _filters = signal<UserFilters>(DEFAULT_USER_FILTERS);

  readonly loading = this._loading.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();
  readonly truncated = this._truncated.asReadonly();
  readonly you = this._you.asReadonly();
  readonly tab = this._tab.asReadonly();
  readonly filters = this._filters.asReadonly();

  readonly appUsers = computed(() => this._users().filter((u) => !u.isAdmin));
  readonly admins = computed(() => this._users().filter((u) => u.isAdmin));
  readonly tabUsers = computed(() => (this._tab() === 'admin' ? this.admins() : this.appUsers()));
  readonly visible = computed(() => {
    const f = this._filters();
    return this.tabUsers().filter((u) => matchesUser(u, f));
  });
  readonly stats = computed(() => statsOf(this.tabUsers()));
  readonly enabledAdmins = computed(() => this.admins().filter((u) => !u.disabled).length);

  constructor() {
    void this.load();
  }

  isBusy(uid: string): boolean {
    return this._busy().has(uid);
  }

  setTab(tab: UserTab): void {
    this._tab.set(tab);
  }

  setFilters(filters: UserFilters): void {
    this._filters.set(filters);
  }

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const list = await this.repository.list();
      this._users.set(list.users);
      this._you.set(list.you);
      this._truncated.set(list.truncated);
      this._error.set(null);
      this._loaded.set(true);
    } catch (e) {
      this._error.set(AppError.from(e).message);
    } finally {
      this._loading.set(false);
    }
  }

  setDisabled(user: AppUser, disabled: boolean): Promise<boolean> {
    return this.run(user.uid, () => this.repository.setDisabled(user.uid, disabled), `${userLabel(user)} ${disabled ? 'disabled' : 'enabled'}`);
  }

  setAdmin(user: AppUser, admin: boolean): Promise<boolean> {
    return this.run(user.uid, () => this.repository.setAdmin(user.uid, admin),
      admin ? `${userLabel(user)} is now an admin` : `${userLabel(user)} is no longer an admin`);
  }

  async inviteAdmin(email: string): Promise<InviteResult | null> {
    try {
      const result = await this.repository.inviteAdmin(email);
      this.upsert(result.user);
      this.notifications.success(`${email} is now an admin`);
      return result;
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
      return null;
    }
  }

  private async run(uid: string, action: () => Promise<AppUser>, success: string): Promise<boolean> {
    this._busy.update((s) => new Set(s).add(uid));
    try {
      this.upsert(await action());
      this.notifications.success(success);
      return true;
    } catch (e) {
      this.notifications.error(AppError.from(e).message);
      return false;
    } finally {
      this._busy.update((s) => {
        const next = new Set(s);
        next.delete(uid);
        return next;
      });
    }
  }

  private upsert(user: AppUser): void {
    this._users.update((list) => {
      const i = list.findIndex((u) => u.uid === user.uid);
      if (i < 0) return [...list, user];
      // Keep receipt stats from the list call (the action responses don't include them).
      const merged = { ...user, receiptCount: list[i].receiptCount, lastReceiptAt: list[i].lastReceiptAt };
      return list.map((u, j) => (j === i ? merged : u));
    });
  }
}
