import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { Clipboard } from '@angular/cdk/clipboard';
import { AppError } from '@core/errors/app-error';
import { NotificationService } from '@core/notifications/notification.service';
import { ReceiptDetail, ReceiptRow, humanize, issueLabel } from '../domain/receipt.model';
import { ReceiptRepository } from '../data-access/receipt.repository';
import { StoreLogoComponent } from '@shared/stores/store-logo.component';

export interface ReceiptDetailData {
  row: ReceiptRow;
  repository: ReceiptRepository;
}

/** Closes with `{ user }` when "All receipts from this user" is clicked. */
export interface ReceiptDetailResult {
  user: string;
}

type Obj = Record<string, unknown>;
const get = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Obj)[k] : undefined), o);

/** Read-only view of one receipt: totals, owner, analysis, line items, photo and OCR text. */
@Component({
  selector: 'app-receipt-detail-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe, DatePipe, DecimalPipe, PercentPipe, MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatProgressBarModule, MatExpansionModule, StoreLogoComponent,
  ],
  template: `
    <div mat-dialog-title class="title">
      <app-store-logo [name]="row.storeName" [size]="44" />
      <div class="title-text">
        <div class="store">{{ row.storeName || 'Unknown store' }}</div>
        <div class="sub">
          {{ row.purchaseDateLocal }} · {{ row.total | currency: row.currency }} · {{ row.lineItemCount }} items
          @if (row.deleted) { <span class="pill danger">Deleted</span> }
        </div>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content class="content">
      @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (error(); as e) { <p class="error">{{ e }}</p> }

      <section class="grid">
        <div class="box photo-box">
          <h3>Photo</h3>
          @if (imageUrl(); as url) {
            <a [href]="url" target="_blank" rel="noopener" matTooltip="Open full size">
              <img class="thumb" [src]="url" alt="Receipt photo" (error)="onImageError()" />
            </a>
          } @else if (imageError()) {
            <p class="muted small">{{ imageError() }}</p>
          } @else if (loading() || imageLoading()) {
            <mat-progress-bar mode="indeterminate" />
          } @else {
            <p class="muted small">No photo was uploaded for this receipt.</p>
          }
        </div>

        <div class="box">
          <h3>Totals</h3>
          <dl>
            <dt>Subtotal</dt><dd>{{ row.subtotal | currency: row.currency }}</dd>
            <dt>Tax</dt><dd>{{ row.tax | currency: row.currency }}</dd>
            <dt>Total</dt><dd><strong>{{ row.total | currency: row.currency }}</strong></dd>
            @if (itemsSum() !== null) {
              <dt>Sum of items</dt>
              <dd [class.warn]="itemsMismatch()">{{ itemsSum() | currency: row.currency }}
                @if (itemsMismatch()) { <mat-icon class="inline" matTooltip="Doesn't match the subtotal">warning_amber</mat-icon> }
              </dd>
            }
            <dt>Payment</dt><dd>{{ humanize(row.paymentMethod) }}</dd>
          </dl>
        </div>

        <div class="box">
          <h3>User</h3>
          <dl>
            <dt>Email</dt><dd>{{ row.email ?? (detail()?.anonymous ? 'Guest (anonymous)' : '—') }}</dd>
            <dt>User ID</dt>
            <dd class="mono">{{ row.uid }}
              <button mat-icon-button class="tiny" matTooltip="Copy" (click)="copy(row.uid)"><mat-icon>content_copy</mat-icon></button>
            </dd>
          </dl>
          <button mat-stroked-button (click)="filterByUser()"><mat-icon>filter_alt</mat-icon> All receipts from this user</button>
        </div>

        <div class="box">
          <h3>Scan</h3>
          <dl>
            <dt>Source</dt><dd>{{ humanize(row.source || 'unknown') }}</dd>
            <dt>Confidence</dt>
            <dd [class.warn]="row.confidence !== null && row.confidence < 0.7">{{ row.confidence === null ? '—' : (row.confidence | percent) }}</dd>
            <dt>Engine</dt><dd>{{ str('ocr.engine') || '—' }} {{ str('ocr.appVersion') ? '· v' + str('ocr.appVersion') : '' }}</dd>
            <dt>Scanned</dt><dd>{{ row.createdAt ? (row.createdAt | date: 'medium') : '—' }}</dd>
            <dt>Receipt ID</dt>
            <dd class="mono">{{ row.id }}
              <button mat-icon-button class="tiny" matTooltip="Copy" (click)="copy(row.id)"><mat-icon>content_copy</mat-icon></button>
            </dd>
          </dl>
        </div>

        <div class="box">
          <h3>Issues found</h3>
          @if (row.duplicateCount || row.overchargeAmount || row.flags.length) {
            <ul class="issues">
              @if (row.duplicateCount) { <li><mat-icon>content_copy</mat-icon> {{ row.duplicateCount }} duplicate line(s)</li> }
              @if (row.overchargeAmount) { <li><mat-icon>savings</mat-icon> {{ row.overchargeAmount | currency: row.currency }} overcharge caught</li> }
              @for (f of row.flags; track f) { <li><mat-icon>flag</mat-icon> {{ issueLabel(f) }}</li> }
            </ul>
          } @else {
            <p class="muted">None</p>
          }
          @if (categoryTotals().length) {
            <h3 class="spaced">By category</h3>
            <dl>
              @for (c of categoryTotals(); track c.id) { <dt>{{ humanize(c.id) }}</dt><dd>{{ c.amount | currency: row.currency }}</dd> }
            </dl>
          }
        </div>
      </section>

      <h3>Line items ({{ detail()?.lineItems?.length ?? row.lineItemCount }})</h3>
      @if (detail(); as d) {
        @if (d.lineItems.length) {
          <div class="table-wrap">
            <table class="items">
              <thead><tr><th>#</th><th>Item</th><th>Category</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Discount</th><th class="num">Total</th></tr></thead>
              <tbody>
                @for (li of d.lineItems; track li.id; let i = $index) {
                  <tr [class.dup]="li.isDuplicate">
                    <td class="muted">{{ (li.position ?? i) + 1 }}</td>
                    <td>
                      {{ li.rawDescription }}
                      @if (li.normalizedName && li.normalizedName !== li.rawDescription?.toLowerCase()) { <div class="muted small">{{ li.normalizedName }}</div> }
                      @if (li.isDuplicate) { <span class="pill warn">Duplicate</span> }
                      @if (li.userCorrected) { <span class="pill">Edited by user</span> }
                    </td>
                    <td>
                      {{ li.category ? humanize(li.category) : '—' }}
                      @if (li.categoryCorrected) { <span class="pill" title="The shopper picked this category in the app">Set by user</span> }
                    </td>
                    <td class="num">{{ li.quantity ?? 1 | number: '1.0-3' }} {{ li.unit && li.unit !== 'each' ? li.unit : '' }}</td>
                    <td class="num">{{ li.unitPrice ?? 0 | currency: row.currency }}</td>
                    <td class="num">{{ li.discount ? (li.discount | currency: row.currency) : '' }}</td>
                    <td class="num">{{ li.lineTotal ?? 0 | currency: row.currency }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">No line items were saved for this receipt.</p>
        }

        <mat-accordion multi>
          <mat-expansion-panel>
            <mat-expansion-panel-header><mat-panel-title>OCR text</mat-panel-title></mat-expansion-panel-header>
            <pre class="ocr">{{ str('ocr.rawText') || 'No OCR text stored.' }}</pre>
          </mat-expansion-panel>
          <mat-expansion-panel>
            <mat-expansion-panel-header><mat-panel-title>Raw document</mat-panel-title></mat-expansion-panel-header>
            <pre class="ocr">{{ rawJson() }}</pre>
          </mat-expansion-panel>
        </mat-accordion>
      }
    </mat-dialog-content>
  `,
  styles: `
    .title { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .title-text { flex: 1; min-width: 0; }
    .store { font-size: 20px; font-weight: 700; }
    .sub { font-size: 14px; color: var(--rt-muted); font-weight: 400; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .content { min-width: min(880px, 92vw); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .box { border: 1px solid var(--rt-divider); border-radius: 12px; padding: 12px 14px; }
    h3 { margin: 0 0 8px; font-size: 14px; font-weight: 700; }
    h3.spaced { margin-top: 12px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0 0 8px; font-size: 13px; }
    dt { color: var(--rt-muted); }
    dd { margin: 0; text-align: right; display: flex; justify-content: flex-end; align-items: center; gap: 2px; min-width: 0; }
    .mono { font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; }
    .tiny { --mdc-icon-button-state-layer-size: 28px; width: 28px; height: 28px; padding: 2px; flex: none; }
    .tiny mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .inline { font-size: 16px; width: 16px; height: 16px; }
    .warn { color: var(--rt-warning); }
    .error { color: var(--rt-danger); }
    .muted { color: var(--rt-muted); }
    .small { font-size: 12px; }
    .issues { list-style: none; margin: 0; padding: 0; font-size: 13px; }
    .issues li { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
    .issues mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--rt-warning); }
    .table-wrap { overflow-x: auto; margin-bottom: 16px; }
    .items { width: 100%; border-collapse: collapse; font-size: 13px; }
    .items th { text-align: left; color: var(--rt-muted); font-weight: 600; padding: 6px 8px; border-bottom: 1px solid var(--rt-divider); }
    .items td { padding: 6px 8px; border-bottom: 1px solid var(--rt-divider); vertical-align: top; }
    .items .num { text-align: right; white-space: nowrap; }
    .items tr.dup td { background: color-mix(in srgb, var(--rt-warning) 10%, transparent); }
    .pill { display: inline-block; font-size: 11px; padding: 1px 8px; border-radius: 999px; margin-left: 4px;
            background: var(--rt-primary-tint); color: var(--rt-primary); }
    .pill.warn { background: color-mix(in srgb, var(--rt-warning) 18%, transparent); color: var(--rt-warning); }
    .pill.danger { background: color-mix(in srgb, var(--rt-danger) 15%, transparent); color: var(--rt-danger); }
    .photo-box { grid-row: span 2; display: flex; flex-direction: column; }
    .thumb { width: 100%; max-height: 420px; object-fit: contain; display: block; border-radius: 8px;
             background: var(--rt-background); cursor: zoom-in; }
    .ocr { white-space: pre-wrap; font-size: 12px; max-height: 360px; overflow: auto; margin: 0; }
  `,
})
export class ReceiptDetailDialogComponent {
  private readonly data = inject<ReceiptDetailData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ReceiptDetailDialogComponent, ReceiptDetailResult>);
  private readonly clipboard = inject(Clipboard);
  private readonly notifications = inject(NotificationService);

  protected readonly row = this.data.row;
  protected readonly humanize = humanize;
  protected readonly issueLabel = issueLabel;

  protected readonly detail = signal<ReceiptDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly imageUrl = signal<string | null>(null);
  protected readonly imageError = signal<string | null>(null);
  protected readonly imageLoading = signal(false);

  protected readonly itemsSum = computed(() => {
    const items = this.detail()?.lineItems;
    if (!items?.length) return null;
    return Math.round(items.reduce((s, li) => s + (typeof li.lineTotal === 'number' ? li.lineTotal : 0), 0) * 100) / 100;
  });
  protected readonly itemsMismatch = computed(() => {
    const sum = this.itemsSum();
    return sum !== null && this.row.subtotal > 0 && Math.abs(sum - this.row.subtotal) > 0.01;
  });
  protected readonly categoryTotals = computed(() => {
    const totals = get(this.detail()?.receipt, 'categoryTotals');
    if (!totals || typeof totals !== 'object') return [];
    return Object.entries(totals as Obj)
      .filter((e): e is [string, number] => typeof e[1] === 'number')
      .map(([id, amount]) => ({ id, amount }))
      .sort((a, b) => b.amount - a.amount);
  });
  protected readonly rawJson = computed(() => {
    const r = { ...(this.detail()?.receipt ?? {}) } as Obj;
    if (r['ocr'] && typeof r['ocr'] === 'object') r['ocr'] = { ...(r['ocr'] as Obj), rawText: '(shown above)' };
    return JSON.stringify(r, null, 2);
  });

  constructor() {
    this.data.repository
      .get(this.row.uid, this.row.id)
      .then((d) => {
        this.detail.set(d);
        void this.loadImage(d);
      })
      .catch((e: unknown) => this.error.set(AppError.from(e).message))
      .finally(() => this.loading.set(false));
  }

  protected str(path: string): string {
    const v = get(this.detail()?.receipt, path);
    return v === null || v === undefined ? '' : String(v);
  }

  protected onImageError(): void {
    this.imageUrl.set(null);
    this.imageError.set('The photo could not be loaded.');
  }

  /** Uses the backend's URL when it built one, else asks Storage (admin-readable via storage.rules). */
  private async loadImage(d: ReceiptDetail): Promise<void> {
    if (d.imageUrl) {
      this.imageUrl.set(d.imageUrl);
      return;
    }
    if (!d.imagePath) return;
    this.imageLoading.set(true);
    try {
      this.imageUrl.set(await this.data.repository.imageUrl(d.imagePath));
    } catch (e) {
      this.imageError.set(AppError.from(e).message);
    } finally {
      this.imageLoading.set(false);
    }
  }

  protected copy(value: string): void {
    this.clipboard.copy(value);
    this.notifications.success('Copied');
  }

  protected filterByUser(): void {
    this.dialogRef.close({ user: this.row.email ?? this.row.uid });
  }
}
