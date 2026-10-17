import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '../domain/store.model';
import { StoresStore } from '../state/stores.store';

export interface MergeStoreData {
  store: Store;
  state: StoresStore;
}

/** Maps a discovered store (often an OCR variant) onto an existing one. Closes with `true`. */
@Component({
  selector: 'app-merge-store-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Map “{{ data.store.name }}” to a store</h2>
    <mat-dialog-content>
      <p class="muted">
        Receipts printed as {{ printed() }} will use the store you pick. Its name is added as an alias and this
        record is removed.
      </p>
      <mat-form-field appearance="outline" class="full" subscriptSizing="dynamic">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Find a store</mat-label>
        <input matInput [value]="query()" (input)="query.set($any($event.target).value)" autocomplete="off" />
      </mat-form-field>
      <ul class="list" role="listbox" aria-label="Stores">
        @for (s of matches(); track s.key) {
          <li role="option" [attr.aria-selected]="picked()?.key === s.key" [class.picked]="picked()?.key === s.key"
              (click)="picked.set(s)" (keydown.enter)="picked.set(s)" tabindex="0">
            <span class="logo">@if (s.iconUrl) { <img [src]="s.iconUrl" alt="" /> } @else { <mat-icon>storefront</mat-icon> }</span>
            <span><strong>{{ s.name }}</strong><span class="muted small"> · {{ s.key }}</span></span>
          </li>
        } @empty {
          <li class="muted empty">No reviewed store matches. Approve this one as a new store instead.</li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-flat-button [disabled]="!picked() || saving()" (click)="merge()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Map to {{ picked()?.name ?? '…' }} }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full { width: min(460px, 80vw); margin-bottom: 8px; }
    .muted { color: var(--rt-muted); font-size: 13px; }
    .small { font-size: 12px; }
    .list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow: auto; border: 1px solid var(--rt-divider); border-radius: 12px; }
    .list li { display: flex; gap: 10px; align-items: center; padding: 8px 12px; cursor: pointer; border-top: 1px solid var(--rt-divider); }
    .list li:first-child { border-top: 0; }
    .list li:hover, .list li:focus { background: var(--rt-primary-tint); outline: none; }
    .list li.picked { background: var(--rt-primary-tint); box-shadow: inset 3px 0 0 var(--rt-primary); }
    .list li.empty { cursor: default; }
    .logo { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--rt-divider); background: #fff;
            display: grid; place-items: center; overflow: hidden; flex: none; }
    .logo img { width: 100%; height: 100%; object-fit: contain; }
    .logo mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--rt-muted); }
  `,
})
export class MergeStoreDialogComponent {
  protected readonly data = inject<MergeStoreData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MergeStoreDialogComponent, boolean>);

  protected readonly query = signal('');
  protected readonly picked = signal<Store | null>(null);
  protected readonly saving = this.data.state.saving;

  protected readonly printed = computed(() =>
    (this.data.store.aliases.length ? this.data.store.aliases : [this.data.store.name]).map((a) => `“${a}”`).join(', '));

  protected readonly matches = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.data.state.activeStores().filter((s) => s.key !== this.data.store.key);
    const hits = q
      ? all.filter((s) => s.name.toLowerCase().includes(q) || s.key.includes(q) || s.aliases.some((a) => a.toLowerCase().includes(q)))
      : all;
    return [...hits].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100);
  });

  protected async merge(): Promise<void> {
    const into = this.picked();
    if (!into) return;
    if (await this.data.state.merge(this.data.store, into)) this.dialogRef.close(true);
  }
}
