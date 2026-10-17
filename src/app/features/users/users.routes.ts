import { Routes } from '@angular/router';
import { CallableUserRepository, UserRepository } from './data-access/user.repository';
import { UsersStore } from './state/users.store';

/** Lazy-loaded. Feature-scoped providers: the repository binding and the state live with the route. */
export const USERS_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: UserRepository, useClass: CallableUserRepository }, UsersStore],
    loadComponent: () => import('./pages/users-list.page').then((m) => m.UsersListPage),
    title: 'Users · ReTally Admin',
  },
];
