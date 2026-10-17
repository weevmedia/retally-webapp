import { Injectable, inject } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { FIREBASE_FUNCTIONS } from '@core/firebase/firebase.providers';
import { AppError } from '@core/errors/app-error';

/**
 * Typed gateway to the admin Cloud Functions. All console writes go through here: the
 * functions re-check the admin claim, validate input and write the audit log.
 */
@Injectable({ providedIn: 'root' })
export class CallableApi {
  private readonly functions = inject(FIREBASE_FUNCTIONS);

  async call<Req, Res>(name: string, data: Req): Promise<Res> {
    try {
      const fn = httpsCallable<Req, Res>(this.functions, name);
      return (await fn(data)).data;
    } catch (e) {
      throw AppError.from(e);
    }
  }
}
