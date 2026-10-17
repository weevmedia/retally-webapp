import { Injectable, inject } from '@angular/core';
import { CallableApi } from '@core/api/callable';
import { AppUser } from '../domain/user.model';

export interface UserList {
  users: AppUser[];
  truncated: boolean;
  /** uid of the signed-in admin. */
  you: string;
}

export interface InviteResult {
  created: boolean;
  /** Link where the person sets their password (not emailed — share it yourself). */
  passwordLink: string | null;
  user: AppUser;
}

/** Port for Firebase Auth accounts (all writes go through admin functions). */
export abstract class UserRepository {
  abstract list(): Promise<UserList>;
  abstract setDisabled(uid: string, disabled: boolean): Promise<AppUser>;
  abstract setAdmin(uid: string, admin: boolean): Promise<AppUser>;
  abstract inviteAdmin(email: string): Promise<InviteResult>;
}

@Injectable()
export class CallableUserRepository extends UserRepository {
  private readonly api = inject(CallableApi);

  list(): Promise<UserList> {
    return this.api.call('adminListUsers', {});
  }

  async setDisabled(uid: string, disabled: boolean): Promise<AppUser> {
    return (await this.api.call<object, { user: AppUser }>('adminSetUserDisabled', { uid, disabled })).user;
  }

  async setAdmin(uid: string, admin: boolean): Promise<AppUser> {
    return (await this.api.call<object, { user: AppUser }>('adminSetAdmin', { uid, admin })).user;
  }

  inviteAdmin(email: string): Promise<InviteResult> {
    return this.api.call('adminInviteAdmin', { email });
  }
}
