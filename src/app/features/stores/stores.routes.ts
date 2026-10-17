import { Routes } from '@angular/router';
import { FirestoreStoreRepository, StoreRepository } from './data-access/store.repository';
import { StoresStore } from './state/stores.store';

/** Lazy-loaded. Feature-scoped providers: the repository binding and the state live with the route. */
export const STORES_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: StoreRepository, useClass: FirestoreStoreRepository }, StoresStore],
    loadComponent: () => import('./pages/stores-list.page').then((m) => m.StoresListPage),
    title: 'Stores · ReTally Admin',
  },
];
