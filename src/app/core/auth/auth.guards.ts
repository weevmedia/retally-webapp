import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Admin-only areas: signed out → /login, signed in without the claim → /login (explains why). */
export const adminGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady;
  return auth.isAdmin() ? true : router.createUrlTree(['/login']);
};

/** Login page: an admin who is already signed in goes straight to the console. */
export const loginGuard: CanMatchFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady;
  return auth.isAdmin() ? router.createUrlTree(['/']) : true;
};
