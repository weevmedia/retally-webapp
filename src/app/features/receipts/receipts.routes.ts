import { Routes } from '@angular/router';
import { CallableReceiptRepository, ReceiptRepository } from './data-access/receipt.repository';
import { ReceiptsStore } from './state/receipts.store';

/** Lazy-loaded. Feature-scoped providers: the repository binding and the state live with the route. */
export const RECEIPTS_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: ReceiptRepository, useClass: CallableReceiptRepository }, ReceiptsStore],
    loadComponent: () => import('./pages/receipts-list.page').then((m) => m.ReceiptsListPage),
    title: 'Receipts · ReTally Admin',
  },
];
