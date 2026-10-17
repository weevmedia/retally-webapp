import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/ui/confirm-dialog.component';
import { ItemCategory, MAX_CATEGORIES } from '../domain/category.model';
import { CategoriesStore } from '../state/categories.store';
import { CategoryFormDialogComponent, CategoryFormData } from '../components/category-form.dialog';

const PREVIEW = 14;

/** Item categories master: ordered list (first = default), keywords, add / edit / reorder / delete. */
@Component({
  selector: 'app-categories-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressBarModule, MatMenuModule, PageHeaderComponent, EmptyStateComponent,
  ],
  template: `
    <app-page-header title="Categories" subtitle="Spending categories the app auto-tags receipt items with.">
      <button mat-flat-button (click)="openForm(null)" [disabled]="state.saving() || atLimit()">
        <mat-icon>add</mat-icon> Add category
      </button>
    </app-page-header>

    <div class="stats">
      <div class="stat"><span class="value">{{ state.categories().length }}</span><span class="label">Categories</span></div>
      <div class="stat"><span class="value">{{ state.keywordCount() }}</span><span class="label">Keywords</span></div>
      <div class="stat"><span class="value" [class.warn]="state.conflicts().size > 0">{{ state.conflicts().size }}</span>
        <span class="label">Shared keywords</span></div>
    </div>

    @if (state.isDefault()) {
      <p class="banner"><mat-icon>info</mat-icon>
        The app is using its built-in defaults. Your first change saves the list to Firestore.</p>
    } @else if (state.updatedAt()) {
      <p class="meta">Last changed {{ state.updatedAt() | date: 'medium' }}{{ state.updatedBy() ? ' by ' + state.updatedBy() : '' }}.
        Phones pick up changes the next time the app loads categories.</p>
    }

    <div class="card">
      <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Search name, ID or keyword</mat-label>
        <input matInput [value]="state.filter()" (input)="state.setFilter($any($event.target).value)" />
      </mat-form-field>

      @if (state.loading() || state.saving()) { <mat-progress-bar mode="indeterminate" /> }

      @if (state.error(); as error) {
        <app-empty-state icon="error_outline" title="Couldn't load categories" [body]="error" />
      } @else if (!state.loading() && state.visible().length === 0) {
        <app-empty-state icon="search_off" title="No matches" body="No category name, ID or keyword matches your search." />
      } @else {
        <ol class="list">
          @for (row of state.visible(); track row.category.id) {
            <li class="item" (click)="openForm(row.category)">
              <span class="pos">{{ row.index + 1 }}</span>
              <div class="body">
                <div class="title">
                  <strong>{{ row.category.name }}</strong>
                  <span class="id">{{ row.category.id }}</span>
                  @if (row.index === 0) { <span class="badge" matTooltip="Items matching no keyword land here">Default</span> }
                </div>
                <div class="keywords">
                  @for (k of row.category.keywords.slice(0, preview); track k) {
                    <span class="kw" [class.shared]="state.conflicts().has(k)"
                          [matTooltip]="state.conflicts().has(k) ? 'Also in: ' + state.conflicts().get(k)!.join(', ') : ''">{{ k }}</span>
                  }
                  @if (row.category.keywords.length > preview) {
                    <span class="more">+{{ row.category.keywords.length - preview }} more</span>
                  }
                  @if (row.category.keywords.length === 0) {
                    <span class="none">{{ row.index === 0 ? 'No keywords needed — catches everything else' : 'No keywords yet' }}</span>
                  }
                </div>
              </div>
              <div class="actions" (click)="$event.stopPropagation()">
                <button mat-icon-button matTooltip="Move up" [disabled]="row.index === 0 || state.saving()"
                        (click)="state.moveBy(row.category.id, -1)"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button matTooltip="Move down"
                        [disabled]="row.index === state.categories().length - 1 || state.saving()"
                        (click)="state.moveBy(row.category.id, 1)"><mat-icon>arrow_downward</mat-icon></button>
                <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="More actions" [disabled]="state.saving()">
                  <mat-icon>more_vert</mat-icon></button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="openForm(row.category)"><mat-icon>edit</mat-icon> Edit</button>
                  <button mat-menu-item [disabled]="row.index === 0" (click)="state.makeDefault(row.category.id)">
                    <mat-icon>star_outline</mat-icon> Make default</button>
                  <button mat-menu-item [disabled]="state.categories().length <= 1" (click)="confirmDelete(row.category, row.index)">
                    <mat-icon>delete_outline</mat-icon> Delete</button>
                </mat-menu>
              </div>
            </li>
          }
        </ol>
      }
    </div>
  `,
  styles: `
    .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .stat { background: var(--rt-surface); border-radius: 14px; padding: 12px 18px; min-width: 140px;
            display: flex; flex-direction: column; box-shadow: var(--rt-shadow); }
    .value { font-size: 24px; font-weight: 700; }
    .value.warn { color: var(--rt-warning); }
    .label { color: var(--rt-muted); font-size: 13px; }
    .banner { display: flex; gap: 8px; align-items: center; background: var(--rt-primary-tint);
              padding: 10px 14px; border-radius: 12px; margin: 0 0 16px; }
    .meta { color: var(--rt-muted); font-size: 13px; margin: 0 0 16px; }
    .card { background: var(--rt-surface); border-radius: 16px; box-shadow: var(--rt-shadow); padding: 16px; }
    .search { width: 100%; max-width: 420px; margin-bottom: 12px; }
    .list { list-style: none; margin: 0; padding: 0; }
    .item { display: flex; gap: 14px; align-items: flex-start; padding: 14px 8px;
            border-top: 1px solid var(--rt-divider); cursor: pointer; }
    .item:first-child { border-top: 0; }
    .item:hover { background: var(--rt-primary-tint); }
    .pos { width: 28px; height: 28px; border-radius: 50%; background: var(--rt-primary-tint); color: var(--rt-primary);
           display: grid; place-items: center; font-weight: 700; font-size: 13px; flex: none; margin-top: 2px; }
    .body { flex: 1; min-width: 0; }
    .title { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .id { color: var(--rt-muted); font-size: 12px; font-family: ui-monospace, monospace; }
    .badge { background: var(--rt-primary); color: #fff; font-size: 11px; font-weight: 600;
             padding: 2px 8px; border-radius: 999px; }
    .keywords { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .kw { background: var(--rt-background); border: 1px solid var(--rt-divider); border-radius: 999px;
          padding: 2px 10px; font-size: 12px; }
    .kw.shared { border-color: var(--rt-warning); color: var(--rt-warning); }
    .more, .none { color: var(--rt-muted); font-size: 12px; padding: 2px 0; }
    .actions { display: flex; flex: none; }
    @media (max-width: 600px) { .actions button:not(:last-child) { display: none; } }
  `,
})
export class CategoriesListPage {
  protected readonly state = inject(CategoriesStore);
  private readonly dialog = inject(MatDialog);
  protected readonly preview = PREVIEW;

  protected atLimit(): boolean {
    return this.state.categories().length >= MAX_CATEGORIES;
  }

  protected openForm(category: ItemCategory | null): void {
    this.dialog.open<CategoryFormDialogComponent, CategoryFormData, boolean>(CategoryFormDialogComponent, {
      data: { category, state: this.state },
      autoFocus: 'first-tabbable',
      maxWidth: '95vw',
    });
  }

  protected confirmDelete(category: ItemCategory, index: number): void {
    const next = this.state.categories()[index === 0 ? 1 : 0];
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: `Delete ${category.name}?`,
          message:
            'New items will no longer be tagged with it. Receipts already tagged keep the old ID.' +
            (index === 0 && next ? ` ${next.name} becomes the default.` : ''),
          confirmLabel: 'Delete',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) void this.state.remove(category.id);
      });
  }
}
