import { Routes } from '@angular/router';
import { CategoryRepository, FirestoreCategoryRepository } from './data-access/category.repository';
import { CategoriesStore } from './state/categories.store';
import { CallableItemAliasRepository, ItemAliasRepository } from './data-access/item-alias.repository';
import { ItemAliasesStore } from './state/item-aliases.store';

/** Lazy-loaded. Feature-scoped providers: the repository binding and the state live with the route. */
export const CATEGORIES_ROUTES: Routes = [
  {
    path: '',
    providers: [{ provide: CategoryRepository, useClass: FirestoreCategoryRepository }, CategoriesStore],
    loadComponent: () => import('./pages/categories-list.page').then((m) => m.CategoriesListPage),
    title: 'Categories · ReTally Admin',
  },
  {
    path: 'ai',
    providers: [{ provide: ItemAliasRepository, useClass: CallableItemAliasRepository }, ItemAliasesStore],
    loadComponent: () => import('./pages/ai-answers.page').then((m) => m.AiAnswersPage),
    title: 'AI answers · ReTally Admin',
  },
];
