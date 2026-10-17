import { Routes } from '@angular/router';
import { adminGuard, loginGuard } from '@core/auth/auth.guards';

/**
 * Top-level routing. Every feature is lazy-loaded behind `adminGuard` (canMatch, so the code
 * for admin screens isn't even downloaded by non-admins).
 */
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [loginGuard],
    loadComponent: () => import('@features/auth/login.page').then((m) => m.LoginPage),
    title: 'Sign in · ReTally Admin',
  },
  {
    path: '',
    canMatch: [adminGuard],
    loadComponent: () => import('@core/layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('@features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        title: 'Dashboard · ReTally Admin',
      },
      { path: 'stores', loadChildren: () => import('@features/stores/stores.routes').then((m) => m.STORES_ROUTES) },
      { path: 'receipts', loadChildren: () => import('@features/receipts/receipts.routes').then((m) => m.RECEIPTS_ROUTES) },
      { path: 'users', loadChildren: () => import('@features/users/users.routes').then((m) => m.USERS_ROUTES) },
      { path: 'categories', loadChildren: () => import('@features/categories/categories.routes').then((m) => m.CATEGORIES_ROUTES) },
    ],
  },
  { path: '**', redirectTo: '' },
];
