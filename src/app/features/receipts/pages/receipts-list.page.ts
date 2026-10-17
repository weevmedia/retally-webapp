import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import {
  DATE_PRESETS, DEFAULT_FILTERS, DatePreset, ISSUES, ImageFilter, ReceiptFilters, ReceiptRow, ReceiptStatus,
  SortField, activeFilterCount, dateRange, filtersFromParams, filtersToParams, humanize, issueLabel,
} from '../domain/receipt.model';
import { ReceiptsStore } from '../state/receipts.store';
import { ReceiptRepository } from '../data-access/receipt.repository';
import { ReceiptDetailData, ReceiptDetailDialogComponent, ReceiptDetailResult } from '../components/receipt-detail.dialog';

const KNOWN_SOURCES = ['scan', 'manual', 'import'];
const KNOWN_PAYMENTS = ['card', 'cash', 'mobile', 'unknown'];

interface Chip {
  label: string;
  clear: Partial<ReceiptFilters>;
}

/** Receipts across all users: filter, sort, page, inspect, export. Read-only. */
@Component({
  selector: 'app-receipts-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, DecimalPipe, ReactiveFormsModule, MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule, MatChipsModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressBarModule, MatBadgeModule, PageHeaderComponent, EmptyStateComponent,
  ],
  template: `
    <app-page-header title="Receipts" subtitle="Every receipt synced by signed-in users. Read-only.">
      <button mat-stroked-button (click)="store.refresh()" [disabled]="store.loading()"><mat-icon>refresh</mat-icon> Refresh</button>
      <button mat-flat-button (click)="store.exportCsv()" [disabled]="store.exporting() || store.total() === 0">
        <mat-icon>download</mat-icon> {{ store.exporting() ? 'Exporting…' : 'Export CSV' }}
      </button>
    </app-page-header>

    <form class="card filters" [formGroup]="form" (submit)="$event.preventDefault()">
      <div class="filter-row">
        <mat-form-field appearance="outline" class="grow" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search store, email, user ID or receipt ID</mat-label>
          <input matInput formControlName="text" autocomplete="off" />
          @if (form.controls.text.value) {
            <button matSuffix mat-icon-button type="button" aria-label="Clear" (click)="form.controls.text.setValue('')"><mat-icon>close</mat-icon></button>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-date">
          <mat-label>Date</mat-label>
          <mat-select formControlName="preset">
            @for (p of presets; track p.id) { <mat-option [value]="p.id">{{ p.label }}</mat-option> }
          </mat-select>
          <mat-hint>{{ rangeLabel() }}</mat-hint>
        </mat-form-field>

        @if (form.controls.preset.value === 'custom') {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-day">
            <mat-label>From</mat-label><input matInput type="date" formControlName="from" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-day">
            <mat-label>To</mat-label><input matInput type="date" formControlName="to" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w-user">
          <mat-icon matPrefix>person</mat-icon>
          <mat-label>User email or ID</mat-label>
          <input matInput formControlName="user" autocomplete="off" />
        </mat-form-field>

        <button mat-stroked-button type="button" class="more" (click)="showMore.set(!showMore())"
                [matBadge]="moreCount() || null" matBadgeSize="small">
          <mat-icon>tune</mat-icon> {{ showMore() ? 'Fewer filters' : 'More filters' }}
        </button>
        @if (filterCount() > 0) {
          <button mat-button type="button" (click)="reset()">Reset</button>
        }
      </div>

      @if (showMore()) {
        <div class="more-grid">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Store contains</mat-label>
            <input matInput formControlName="store" autocomplete="off" />
          </mat-form-field>
          <div class="pair">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Total min</mat-label><input matInput type="number" min="0" formControlName="minTotal" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Total max</mat-label><input matInput type="number" min="0" formControlName="maxTotal" />
            </mat-form-field>
          </div>
          <div class="pair">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Items min</mat-label><input matInput type="number" min="0" formControlName="minItems" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Items max</mat-label><input matInput type="number" min="0" formControlName="maxItems" />
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Issues (any of)</mat-label>
            <mat-select formControlName="issues" multiple>
              @for (i of issueOptions(); track i.id) { <mat-option [value]="i.id">{{ i.label }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Category (any of)</mat-label>
            <mat-select formControlName="categories" multiple>
              @for (c of categoryOptions(); track c) { <mat-option [value]="c">{{ humanize(c) }}</mat-option> }
              @if (categoryOptions().length === 0) { <mat-option disabled>No categories in this date range</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Source</mat-label>
            <mat-select formControlName="sources" multiple>
              @for (s of sourceOptions(); track s) { <mat-option [value]="s">{{ humanize(s) }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Payment</mat-label>
            <mat-select formControlName="paymentMethods" multiple>
              @for (p of paymentOptions(); track p) { <mat-option [value]="p">{{ humanize(p) }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Currency</mat-label>
            <mat-select formControlName="currencies" multiple>
              @for (c of currencyOptions(); track c) { <mat-option [value]="c">{{ c }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Photo</mat-label>
            <mat-select formControlName="hasImage">
              <mat-option value="any">Any</mat-option>
              <mat-option value="yes">Has photo</mat-option>
              <mat-option value="no">No photo</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="active">Active</mat-option>
              <mat-option value="deleted">Deleted by user</mat-option>
              <mat-option value="all">All</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-checkbox formControlName="searchOcr" class="ocr">Search also matches OCR text</mat-checkbox>
        </div>
      }

      @if (chips().length) {
        <mat-chip-set class="chips" aria-label="Active filters">
          @for (c of chips(); track c.label) {
            <mat-chip (removed)="clear(c)">{{ c.label }}
              <button matChipRemove [attr.aria-label]="'Remove ' + c.label"><mat-icon>cancel</mat-icon></button>
            </mat-chip>
          }
        </mat-chip-set>
      }
    </form>

    @if (store.summary(); as s) {
      <div class="stats">
        <div class="stat"><span class="value">{{ s.count | number }}</span><span class="label">Receipts</span></div>
        <div class="stat"><span class="value">{{ s.users | number }}</span><span class="label">Users</span></div>
        <div class="stat"><span class="value">{{ s.stores | number }}</span><span class="label">Stores</span></div>
        <div class="stat"><span class="value">{{ s.items | number }}</span><span class="label">Line items</span></div>
        @for (c of money(s.spentByCurrency); track c.currency) {
          <div class="stat"><span class="value">{{ c.amount | currency: c.currency : 'symbol' : '1.0-0' }}</span><span class="label">Spent ({{ c.currency }})</span></div>
        }
        @for (c of money(s.overchargeByCurrency); track c.currency) {
          <div class="stat"><span class="value good">{{ c.amount | currency: c.currency }}</span><span class="label">Overcharge caught</span></div>
        }
        <div class="stat"><span class="value" [class.warn]="s.withIssues > 0">{{ s.withIssues | number }}</span><span class="label">With issues</span></div>
      </div>
    }

    @if (store.truncated()) {
      <p class="banner warn"><mat-icon>info</mat-icon>
        There are more than {{ store.scanned() | number }} receipts, so only {{ store.scanned() | number }} were searched.
        Filter by user to see everything for one person.</p>
    }
    @if (store.summary()?.undated; as undated) {
      <p class="banner"><mat-icon>event_busy</mat-icon>
        {{ undated | number }} receipt(s) have no date, so they only appear under “All time”.</p>
    }

    <div class="card">
      @if (store.loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (store.error(); as error) {
        <app-empty-state icon="error_outline" title="Couldn't load receipts" [body]="error">
          <button mat-flat-button (click)="store.refresh()">Try again</button>
        </app-empty-state>
      } @else if (store.userNotFound()) {
        <app-empty-state icon="person_off" title="No such user" body="No account uses that email. Check the spelling, or paste the user ID instead." />
      } @else if (store.loaded() && store.total() === 0) {
        <app-empty-state icon="receipt_long" title="No receipts match"
                         [body]="filterCount() ? 'Try a wider date range or fewer filters.' : 'No receipts have been synced in this date range yet.'">
          @if (filterCount()) { <button mat-stroked-button (click)="reset()">Reset filters</button> }
        </app-empty-state>
      } @else if (store.loaded()) {
        <div class="table-wrap">
          <table mat-table [dataSource]="store.rows()" matSort [matSortActive]="store.sortField()"
                 [matSortDirection]="store.sortDir()" matSortDisableClear (matSortChange)="onSort($event)">
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
              <td mat-cell *matCellDef="let r" class="nowrap">{{ r.purchaseDateLocal }}</td>
            </ng-container>
            <ng-container matColumnDef="store">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Store</th>
              <td mat-cell *matCellDef="let r">
                <strong>{{ r.storeName || '—' }}</strong>
                @if (r.deleted) { <span class="pill danger">Deleted</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>User</th>
              <td mat-cell *matCellDef="let r" class="user">
                <button mat-button class="link" type="button" matTooltip="Show only this user's receipts"
                        (click)="filterUser(r); $event.stopPropagation()">{{ r.email ?? 'Guest · ' + r.uid.slice(0, 6) }}</button>
              </td>
            </ng-container>
            <ng-container matColumnDef="items">
              <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="num">Items</th>
              <td mat-cell *matCellDef="let r" class="num">{{ r.lineItemCount }}</td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="num">Total</th>
              <td mat-cell *matCellDef="let r" class="num nowrap">{{ r.total | currency: r.currency }}</td>
            </ng-container>
            <ng-container matColumnDef="overcharge">
              <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="num">Caught</th>
              <td mat-cell *matCellDef="let r" class="num nowrap good">{{ r.overchargeAmount ? (r.overchargeAmount | currency: r.currency) : '' }}</td>
            </ng-container>
            <ng-container matColumnDef="issues">
              <th mat-header-cell *matHeaderCellDef>Issues</th>
              <td mat-cell *matCellDef="let r" class="issues">
                @if (r.duplicateCount) { <mat-icon matTooltip="{{ r.duplicateCount }} duplicate line(s)">content_copy</mat-icon> }
                @for (f of r.flags; track f) { <mat-icon [matTooltip]="issueLabel(f)">flag</mat-icon> }
                @if (r.confidence !== null && r.confidence < 0.7) { <mat-icon matTooltip="Low scan confidence">blur_on</mat-icon> }
                @if (r.hasImage) { <mat-icon class="muted" matTooltip="Has photo">photo_camera</mat-icon> }
              </td>
            </ng-container>
            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef>Source</th>
              <td mat-cell *matCellDef="let r" class="muted">{{ humanize(r.source || '—') }} · {{ humanize(r.paymentMethod) }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns" class="receipt-row" [class.deleted]="row.deleted" (click)="open(row)"></tr>
          </table>
        </div>
        <mat-paginator [length]="store.total()" [pageIndex]="store.page()" [pageSize]="store.pageSize()"
                       [pageSizeOptions]="[25, 50, 100, 250]" showFirstLastButtons (page)="onPage($event)" />
      }
    </div>
  `,
  styles: `
    .card { background: var(--rt-surface); border-radius: 16px; box-shadow: var(--rt-shadow); padding: 16px; }
    .filters { margin-bottom: 16px; }
    .filter-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .grow { flex: 1 1 280px; }
    .w-date { width: 190px; }
    .w-day { width: 165px; }
    .w-user { width: 250px; }
    .more { height: 56px; }
    .more-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 16px; align-items: center; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ocr { margin-left: 4px; }
    .chips { margin-top: 12px; display: block; }
    .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .stat { background: var(--rt-surface); border-radius: 14px; padding: 12px 18px; min-width: 120px;
            display: flex; flex-direction: column; box-shadow: var(--rt-shadow); }
    .value { font-size: 22px; font-weight: 700; }
    .value.warn { color: var(--rt-warning); }
    .good { color: var(--rt-primary); }
    .label { color: var(--rt-muted); font-size: 13px; }
    .banner { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-radius: 12px; margin: 0 0 16px;
              background: color-mix(in srgb, var(--rt-warning) 14%, transparent); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; background: transparent; }
    .num { text-align: right; }
    .nowrap { white-space: nowrap; }
    .muted { color: var(--rt-muted); }
    .user .link { padding: 0 4px; min-width: 0; height: 28px; font-weight: 400; max-width: 240px;
                  overflow: hidden; text-overflow: ellipsis; justify-content: flex-start; }
    .issues { white-space: nowrap; }
    .issues mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--rt-warning); margin-right: 2px; }
    .issues mat-icon.muted { color: var(--rt-muted); }
    .pill.danger { font-size: 11px; padding: 1px 8px; border-radius: 999px; margin-left: 6px;
                   background: color-mix(in srgb, var(--rt-danger) 15%, transparent); color: var(--rt-danger); }
    .receipt-row { cursor: pointer; }
    .receipt-row:hover { background: var(--rt-primary-tint); }
    .receipt-row.deleted td { opacity: .6; }
    td.mat-mdc-cell { vertical-align: middle; }
    @media (max-width: 700px) { .w-date, .w-user, .w-day { width: 100%; } .more { width: 100%; } }
  `,
})
export class ReceiptsListPage {
  protected readonly store = inject(ReceiptsStore);
  private readonly repository = inject(ReceiptRepository);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly presets = DATE_PRESETS;
  protected readonly columns = ['date', 'store', 'user', 'items', 'total', 'overcharge', 'issues', 'source'];
  protected readonly humanize = humanize;
  protected readonly issueLabel = issueLabel;
  protected readonly showMore = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    preset: DEFAULT_FILTERS.preset as DatePreset,
    from: '',
    to: '',
    text: '',
    searchOcr: false,
    user: '',
    store: '',
    minTotal: null as number | null,
    maxTotal: null as number | null,
    minItems: null as number | null,
    maxItems: null as number | null,
    sources: [[] as string[]],
    paymentMethods: [[] as string[]],
    currencies: [[] as string[]],
    categories: [[] as string[]],
    issues: [[] as string[]],
    status: 'active' as ReceiptStatus,
    hasImage: 'any' as ImageFilter,
  });

  private readonly filters = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue() as ReceiptFilters)), {
    initialValue: this.form.getRawValue() as ReceiptFilters,
  });
  protected readonly filterCount = computed(() => activeFilterCount(this.filters()));
  protected readonly moreCount = computed(() => {
    const f = this.filters();
    return activeFilterCount({ ...f, text: '', user: '', preset: DEFAULT_FILTERS.preset });
  });
  protected readonly rangeLabel = computed(() => {
    const { from, to } = dateRange(this.filters());
    if (!from && !to) return 'Every receipt';
    return `${from ?? '…'} → ${to ?? 'today'}`;
  });

  private readonly facets = this.store.facets;
  private withSelected(options: readonly string[], selected: readonly string[]): string[] {
    return [...new Set([...options, ...selected])].sort();
  }
  protected readonly sourceOptions = computed(() =>
    this.withSelected([...KNOWN_SOURCES, ...(this.facets()?.sources ?? [])], this.filters().sources));
  protected readonly paymentOptions = computed(() =>
    this.withSelected([...KNOWN_PAYMENTS, ...(this.facets()?.paymentMethods ?? [])], this.filters().paymentMethods));
  protected readonly currencyOptions = computed(() =>
    this.withSelected(this.facets()?.currencies ?? [], this.filters().currencies));
  protected readonly categoryOptions = computed(() =>
    this.withSelected(this.facets()?.categories ?? [], this.filters().categories));
  protected readonly issueOptions = computed(() => {
    const known = new Set(ISSUES.map((i) => i.id));
    const extra = (this.facets()?.flags ?? []).filter((f) => !known.has(f)).map((id) => ({ id, label: issueLabel(id) }));
    return [...ISSUES, ...extra];
  });

  /** One removable chip per active filter, so it's always clear what's applied. */
  protected readonly chips = computed<Chip[]>(() => {
    const f = this.filters();
    const out: Chip[] = [];
    const list = (key: 'sources' | 'paymentMethods' | 'currencies' | 'categories' | 'issues', name: string, fmt: (v: string) => string) => {
      if (f[key].length) out.push({ label: `${name}: ${f[key].map(fmt).join(', ')}`, clear: { [key]: [] } });
    };
    if (f.text) out.push({ label: `Search: "${f.text}"${f.searchOcr ? ' (incl. OCR)' : ''}`, clear: { text: '', searchOcr: false } });
    if (f.user) out.push({ label: `User: ${f.user}`, clear: { user: '' } });
    if (f.store) out.push({ label: `Store: ${f.store}`, clear: { store: '' } });
    if (f.minTotal !== null || f.maxTotal !== null) {
      out.push({ label: `Total: ${f.minTotal ?? 0} – ${f.maxTotal ?? '∞'}`, clear: { minTotal: null, maxTotal: null } });
    }
    if (f.minItems !== null || f.maxItems !== null) {
      out.push({ label: `Items: ${f.minItems ?? 0} – ${f.maxItems ?? '∞'}`, clear: { minItems: null, maxItems: null } });
    }
    list('issues', 'Issues', issueLabel);
    list('categories', 'Category', humanize);
    list('sources', 'Source', humanize);
    list('paymentMethods', 'Payment', humanize);
    list('currencies', 'Currency', (v) => v);
    if (f.hasImage !== 'any') out.push({ label: f.hasImage === 'yes' ? 'Has photo' : 'No photo', clear: { hasImage: 'any' } });
    if (f.status !== 'active') out.push({ label: f.status === 'deleted' ? 'Deleted only' : 'Including deleted', clear: { status: 'active' } });
    return out;
  });

  constructor() {
    // URL → form (bookmarks / shared links), then every form change → search + URL.
    const params = this.route.snapshot.queryParamMap;
    this.form.reset(filtersFromParams((k) => params.get(k)), { emitEvent: false });
    if (this.moreCount() > 0) this.showMore.set(true);
    this.store.setFilters(this.form.getRawValue() as ReceiptFilters);

    this.form.valueChanges
      .pipe(
        debounceTime(350),
        map(() => this.form.getRawValue() as ReceiptFilters),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((filters) => {
        if (filters.preset === 'custom' && filters.from && filters.to && filters.from > filters.to) return;
        this.store.setFilters(filters);
        void this.router.navigate([], { relativeTo: this.route, queryParams: filtersToParams(filters), replaceUrl: true });
      });
  }

  protected money(map: Record<string, number>): { currency: string; amount: number }[] {
    return Object.entries(map)
      .filter(([currency]) => /^[A-Z]{3}$/.test(currency))
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }

  protected onSort(sort: Sort): void {
    this.store.setSort(sort.active as SortField, sort.direction === 'asc' ? 'asc' : 'desc');
  }

  protected onPage(e: PageEvent): void {
    this.store.setPage(e.pageIndex, e.pageSize);
  }

  protected clear(chip: Chip): void {
    this.form.patchValue(chip.clear);
  }

  protected reset(): void {
    this.form.reset(DEFAULT_FILTERS);
  }

  protected filterUser(row: ReceiptRow): void {
    this.form.patchValue({ user: row.email ?? row.uid });
  }

  protected open(row: ReceiptRow): void {
    this.dialog
      .open<ReceiptDetailDialogComponent, ReceiptDetailData, ReceiptDetailResult>(ReceiptDetailDialogComponent, {
        data: { row, repository: this.repository },
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.user) this.form.patchValue({ user: result.user });
      });
  }
}
