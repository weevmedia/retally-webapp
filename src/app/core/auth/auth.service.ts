import { Injectable, computed, inject, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  User,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { FIREBASE_AUTH } from '@core/firebase/firebase.providers';

/** Who is signed in to the console, and whether they hold the `admin` custom claim. */
export interface AdminSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  isAdmin: boolean;
}

/**
 * Firebase Auth for the admin console (Google or email/password sign-in).
 *
 * Authorisation is the `admin: true` custom claim on the ID token — set with
 * `backend/functions/scripts/set-admin.mjs`. The UI hides admin screens without it, but the
 * real enforcement is server-side: security rules and every admin Cloud Function check the
 * same claim.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FIREBASE_AUTH);

  private readonly _session = signal<AdminSession | null>(null);
  private readonly _ready = signal(false);

  /** Current session, or null when signed out. */
  readonly session = this._session.asReadonly();
  /** False until Firebase has restored (or ruled out) a persisted session. */
  readonly ready = this._ready.asReadonly();
  readonly isSignedIn = computed(() => this._session() !== null);
  readonly isAdmin = computed(() => this._session()?.isAdmin === true);

  /** Resolves once the first auth state is known; guards await it. */
  readonly whenReady: Promise<void>;

  constructor() {
    this.whenReady = new Promise<void>((resolve) => {
      // onIdTokenChanged (not onAuthStateChanged) so a refreshed token with new claims is picked up.
      onIdTokenChanged(this.auth, async (user) => {
        this._session.set(user ? await this.toSession(user) : null);
        this._ready.set(true);
        resolve();
      });
    });
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(this.auth, provider);
  }

  /** Email/password sign-in for accounts added in Firebase console → Authentication → Users. */
  async signInWithEmail(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email.trim(), password);
  }

  /** Emails a link to set a new password (also how a manually added user picks their own). */
  sendPasswordReset(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email.trim());
  }

  /** Re-reads claims, e.g. right after `set-admin.mjs` granted access. */
  async refreshClaims(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    await user.getIdToken(true);
    this._session.set(await this.toSession(user));
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  private async toSession(user: User): Promise<AdminSession> {
    const token = await user.getIdTokenResult();
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoURL,
      isAdmin: token.claims['admin'] === true,
    };
  }
}
