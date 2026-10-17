import { AfterViewInit, ChangeDetectionStrategy, Component, effect, inject, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/ui/confirm-dialog.component';
import { Store, compareForReview } from '../domain/store.model';
import { StoresStore } from '../state/stores.store';
import { StoreFormDialogComponent, StoreFormData } from '../components/store-form.dialog';
import { MergeStoreData, MergeStoreDialogComponent } from '../components/merge-store.dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';

/** Stores master table: search, sort, page, add / edit / delete. */
@Component({
  selector: 'app-stores-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, MatTableModule, MatSortModule, MatPaginatorModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatTooltipModule, MatProgressBarModule, MatSlideToggleModule, MatMenuModule,
    PageHeaderComponent, EmptyStateComponent,
  ],
  template: `
    <app-page-header title="Stores" subtitle="Store names, logos and the receipt names that map to them.">
      <button mat-stroked-button (click)="state.discover()" [disabled]="state.discovering()"
              matTooltip="Check every receipt for stores that aren't in this list yet">
        <mat-icon>travel_explore</mat-icon> {{ state.discovering() ? 'Checking receipts…' : 'Find stores from receipts' }}
      </button>
      <button mat-flat-button (click)="openForm(null)"><mat-icon>add</mat-icon> Add store</button>
    </app-page-header>

    <div class="stats">
      <div class="stat"><span class="value">{{ state.total() }}</span><span class="label">Stores</span></div>
      <button type="button" class="stat clickable" [class.active]="state.onlyNew()" (click)="state.setOnlyNew(!state.onlyNew())"
              [attr.aria-pressed]="state.onlyNew()" matTooltip="Stores found on receipts that need a review">
        <span class="value" [class.warn]="state.newCount() > 0">{{ state.newCount() }}</span><span class="label">Needs review</span>
      </button>
      <div class="stat"><span class="value" [class.warn]="state.withoutLogo() > 0">{{ state.withoutLogo() }}</span>
        <span class="label">Missing logo</span></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search name, key or alias</mat-label>
          <input matInput [value]="state.filter()" (input)="state.setFilter($any($event.target).value)" />
        </mat-form-field>
        <mat-slide-toggle [checked]="state.onlyNew()" (change)="state.setOnlyNew($event.checked)">Only needs review</mat-slide-toggle>
      </div>

      @if (state.loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (state.error(); as error) {
        <app-empty-state icon="error_outline" title="Couldn't load stores" [body]="error" />
      } @else if (!state.loading() && state.total() === 0) {
        <app-empty-state icon="storefront" title="No stores yet" body="Add the stores your users shop at most.">
          <button mat-flat-button (click)="openForm(null)">Add store</button>
        </app-empty-state>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="dataSource" matSort matSortActive="name" matSortDirection="asc">
            <ng-container matColumnDef="logo">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s">
                <div class="logo" [class.placeholder]="!s.iconUrl">
                  @if (s.iconUrl) { <img [src]="s.iconUrl" [alt]="s.name" loading="lazy" /> }
                  @else { <mat-icon matTooltip="No logo yet — the app shows a letter tile">storefront</mat-icon> }
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Name</th>
              <td mat-cell *matCellDef="let s">
                <strong>{{ s.name }}</strong>
                @if (s.status === 'new') { <span class="badge">New</span> }
                <div class="key">{{ s.key }}@if (s.receiptCount !== null) { · {{ s.receiptCount }} receipt{{ s.receiptCount === 1 ? '' : 's' }} }</div>
              </td>
            </ng-container>
            <ng-container matColumnDef="aliases">
              <th mat-header-cell *matHeaderCellDef>Aliases</th>
              <td mat-cell *matCellDef="let s" class="aliases">{{ s.aliases.join(', ') || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
              <td mat-cell *matCellDef="let s">{{ s.category ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="updatedAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Updated</th>
              <td mat-cell *matCellDef="let s">
                {{ s.updatedAt ? (s.updatedAt | date: 'mediumDate') : '—' }}
                @if (s.updatedBy) { <div class="key">{{ s.updatedBy }}</div> }
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let s" class="actions">
                @if (s.status === 'new') {
                  <button mat-stroked-button class="approve" (click)="openForm(s); $event.stopPropagation()">Review</button>
                  <button mat-icon-button matTooltip="Map to an existing store" (click)="openMerge(s); $event.stopPropagation()">
                    <mat-icon>call_merge</mat-icon></button>
                } @else {
                  <button mat-icon-button matTooltip="Edit" (click)="openForm(s); $event.stopPropagation()">
                    <mat-icon>edit</mat-icon></button>
                }
                <button mat-icon-button matTooltip="Delete" (click)="confirmDelete(s); $event.stopPropagation()">
                  <mat-icon>delete_outline</mat-icon></button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" class="store-row" [class.is-new]="row.status === 'new'" (click)="openForm(row)"></tr>
          </table>
        </div>
        <mat-paginator [pageSizeOptions]="[25, 50, 100]" showFirstLastButtons />
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
    .card { background: var(--rt-surface); border-radius: 16px; box-shadow: var(--rt-shadow); padding: 16px; }
    .toolbar { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
    .search { width: 100%; max-width: 420px; }
    button.stat { border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    button.stat.active { box-shadow: inset 0 0 0 2px var(--rt-warning), var(--rt-shadow); }
    .badge { display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px;
             background: color-mix(in srgb, var(--rt-warning) 18%, transparent); color: var(--rt-warning); vertical-align: middle; }
    .logo.placeholder { background: var(--rt-background); border-style: dashed; }
    .approve { margin-right: 4px; height: 32px; }
    .store-row.is-new { background: color-mix(in srgb, var(--rt-warning) 6%, transparent); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; background: transparent; }
    .logo { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--rt-divider);
            display: grid; place-items: center; overflow: hidden; background: #fff; }
    .logo img { width: 100%; height: 100%; object-fit: contain; }
    .logo mat-icon { color: var(--rt-muted); font-size: 20px; width: 20px; height: 20px; }
    .key { color: var(--rt-muted); font-size: 12px; }
    .aliases { max-width: 320px; color: var(--rt-muted); }
    .actions { white-space: nowrap; text-align: right; }
    .store-row { cursor: pointer; }
    .store-row:hover { background: var(--rt-primary-tint); }
    td.mat-mdc-cell { vertical-align: middle; }
  `,
})
export class StoresListPage implements AfterViewInit {
  protected readonly state = inject(StoresStore);
  private readonly dialog = inject(MatDialog);

  protected readonly columns = ['logo', 'name', 'aliases', 'category', 'updatedAt', 'actions'];
  protected readonly dataSource = new MatTableDataSource<Store>([]);

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    // Signals → table data source.
    effect(() => {
      this.dataSource.data = this.state.visible();
    });
    // The table is inside @if, so sort/paginator appear after the first load.
    effect(() => {
      const sort = this.sort();
      const paginator = this.paginator();
      if (sort) this.dataSource.sort = sort;
      if (paginator) this.dataSource.paginator = paginator;
    });
    // Stores waiting for review always stay on top, whatever column is sorted.
    const sortData = this.dataSource.sortData;
    this.dataSource.sortData = (data, sort) => {
      const sorted = sortData(data, sort);
      return [...sorted.filter((s) => s.status === 'new').sort(compareForReview), ...sorted.filter((s) => s.status !== 'new')];
    };
    this.dataSource.sortingDataAccessor = (s, column) =>
      column === 'updatedAt' ? (s.updatedAt?.getTime() ?? 0) : column === 'name' ? s.name.toLowerCase() : (s.category ?? '');
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.paginator = this.paginator() ?? null;
  }

  protected openForm(store: Store | null): void {
    this.dialog.open<StoreFormDialogComponent, StoreFormData, boolean>(StoreFormDialogComponent, {
      data: { store, state: this.state },
      autoFocus: 'first-tabbable',
      maxWidth: '95vw',
    });
  }

  protected openMerge(store: Store): void {
    this.dialog.open<MergeStoreDialogComponent, MergeStoreData, boolean>(MergeStoreDialogComponent, {
      data: { store, state: this.state },
      autoFocus: 'first-tabbable',
      maxWidth: '95vw',
    });
  }

  protected confirmDelete(store: Store): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: `Delete ${store.name}?`,
          message: 'The app will fall back to a letter tile for this store. Receipts are not affected.',
          confirmLabel: 'Delete',
          destructive: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) void this.state.remove(store);
      });
  }
}
