import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { STORE_CATEGORIES, Store, StoreCategory, normalizeAliases, storeKeyOf } from '../domain/store.model';
import { StoresStore } from '../state/stores.store';

export interface StoreFormData {
  /** Null to create a new store. */
  store: Store | null;
  state: StoresStore;
}

/** Create / edit a store: name, key, category, aliases and logo. Closes with `true` after a save. */
@Component({
  selector: 'app-store-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatChipsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isNew ? 'Add store' : isReview ? 'Review new store' : 'Edit ' + data.store?.name }}</h2>
    @if (isReview) {
      <p class="review">
        Found on {{ data.store?.receiptCount ?? 'a' }} receipt{{ data.store?.receiptCount === 1 ? '' : 's' }} but not in your stores yet.
        Fix the name, add a logo and save to approve it.
      </p>
    }
    <mat-dialog-content>
      <form [formGroup]="form" class="form" id="storeForm" (ngSubmit)="submit()">
        <div class="logo-row">
          <div class="logo">
            @if (previewUrl()) { <img [src]="previewUrl()" alt="Logo preview" /> }
            @else { <mat-icon>storefront</mat-icon> }
          </div>
          <div>
            <button mat-stroked-button type="button" (click)="fileInput.click()">
              <mat-icon>upload</mat-icon> {{ previewUrl() ? 'Replace logo' : 'Upload logo' }}
            </button>
            <p class="hint">PNG, JPEG, WebP or SVG · square · under 1 MB</p>
            <input #fileInput type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden
                   (change)="onFile($event)" />
          </div>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Display name</mat-label>
          <input matInput formControlName="name" placeholder="Trader Joe's" autocomplete="off" />
          @if (form.controls.name.hasError('required')) { <mat-error>Name is required</mat-error> }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Key</mat-label>
          <input matInput [value]="key()" readonly />
          <mat-hint>{{ isNew ? 'Generated from the name, the same way the app matches receipts.' : 'Fixed once created.' }}</mat-hint>
          @if (keyTaken()) { <mat-hint class="error">A store with this key already exists.</mat-hint> }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Weekly ad link</mat-label>
          <input matInput formControlName="weeklyAdUrl" type="url" inputmode="url"
                 placeholder="https://www.example.com/weekly-ad" autocomplete="off" />
          @if (adUrl()) {
            <a matSuffix mat-icon-button [href]="adUrl()" target="_blank" rel="noopener" aria-label="Open weekly ad">
              <mat-icon>open_in_new</mat-icon>
            </a>
          }
          <mat-hint>Opens when a user taps this store in their favourites. Leave empty for none.</mat-hint>
          @if (form.controls.weeklyAdUrl.hasError('pattern')) { <mat-error>Use a full https:// link</mat-error> }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            <mat-option [value]="null">None</mat-option>
            @for (c of categories; track c) { <mat-option [value]="c">{{ c }}</mat-option> }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Aliases (names printed on receipts)</mat-label>
          <mat-chip-grid #chipGrid>
            @for (alias of aliases(); track alias) {
              <mat-chip-row (removed)="removeAlias(alias)">
                {{ alias }}
                <button matChipRemove [attr.aria-label]="'Remove ' + alias"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input placeholder="e.g. WM SUPERCENTER, press Enter"
                   [matChipInputFor]="chipGrid"
                   [matChipInputSeparatorKeyCodes]="separators"
                   (matChipInputTokenEnd)="addAlias($event)" />
          </mat-chip-grid>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-flat-button type="submit" form="storeForm" [disabled]="!canSave()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { {{ isReview ? 'Approve' : 'Save' }} }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 4px; min-width: min(480px, 80vw); padding-top: 8px; }
    .logo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .logo { width: 72px; height: 72px; border-radius: 16px; border: 1px solid var(--rt-divider);
            display: grid; place-items: center; overflow: hidden; background: #fff; }
    .logo img { width: 100%; height: 100%; object-fit: contain; }
    .logo mat-icon { color: var(--rt-muted); }
    .hint { margin: 6px 0 0; font-size: 12px; color: var(--rt-muted); }
    .error { color: var(--rt-danger); }
    .review { margin: 0 24px; padding: 8px 12px; border-radius: 10px; font-size: 13px;
              background: color-mix(in srgb, var(--rt-warning) 14%, transparent); }
  `,
})
export class StoreFormDialogComponent {
  protected readonly data = inject<StoreFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<StoreFormDialogComponent, boolean>);
  private readonly fb = inject(FormBuilder);

  protected readonly isNew = this.data.store === null;
  /** A store the backend created from a receipt; saving approves it. */
  protected readonly isReview = this.data.store?.status === 'new';
  protected readonly categories = STORE_CATEGORIES;
  protected readonly separators = [ENTER, COMMA] as const;
  protected readonly saving = this.data.state.saving;

  protected readonly form = this.fb.nonNullable.group({
    name: [this.data.store?.name ?? '', [Validators.required, Validators.maxLength(64)]],
    category: this.fb.control<StoreCategory | null>(this.data.store?.category ?? null),
    weeklyAdUrl: [this.data.store?.weeklyAdUrl ?? '', [Validators.pattern(/^\s*(https:\/\/\S+)?\s*$/), Validators.maxLength(2048)]],
  });

  protected readonly aliases = signal<string[]>(this.data.store?.aliases ?? []);
  private readonly logoFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string>(this.data.store?.iconUrl ?? '');

  private readonly name = toSignal(this.form.controls.name.valueChanges, { initialValue: this.form.controls.name.value });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly adValue = toSignal(this.form.controls.weeklyAdUrl.valueChanges, { initialValue: this.form.controls.weeklyAdUrl.value });
  /** The typed link when it's valid, for the "open" button. */
  protected readonly adUrl = computed(() => {
    const url = this.adValue().trim();
    return /^https:\/\/\S+$/.test(url) ? url : '';
  });

  /** New stores derive the key from the name; existing keys never change (the app matches on them). */
  protected readonly key = computed(() => (this.isNew ? storeKeyOf(this.name()) : this.data.store!.key));
  protected readonly keyTaken = computed(() => this.isNew && this.data.state.exists(this.key()));
  protected readonly canSave = computed(
    () => this.status() === 'VALID' && !this.keyTaken() && this.key() !== 'unknown' && !this.saving(),
  );

  protected addAlias(event: MatChipInputEvent): void {
    const value = event.value.trim();
    if (value) this.aliases.update((list) => normalizeAliases([...list, value]));
    event.chipInput.clear();
  }

  protected removeAlias(alias: string): void {
    this.aliases.update((list) => list.filter((a) => a !== alias));
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
  }

  protected async submit(): Promise<void> {
    if (!this.canSave()) return;
    const value = this.form.getRawValue();
    const ok = await this.data.state.save(
      {
        key: this.key(),
        name: value.name.trim(),
        category: value.category,
        aliases: normalizeAliases(this.aliases()),
        iconUrl: this.data.store?.iconUrl ?? '',
        weeklyAdUrl: value.weeklyAdUrl.trim(),
      },
      this.isNew,
      this.logoFile(),
    );
    if (ok) this.dialogRef.close(true);
  }
}
