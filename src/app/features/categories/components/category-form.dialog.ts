import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ItemCategory, MAX_KEYWORDS, categoryIdOf, normalizeKeywords } from '../domain/category.model';
import { CategoriesStore } from '../state/categories.store';

export interface CategoryFormData {
  /** Null to create a new category. */
  category: ItemCategory | null;
  state: CategoriesStore;
}

/** Create / edit an item category: name, id (fixed once created) and keywords. */
@Component({
  selector: 'app-category-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatChipsModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isNew ? 'Add category' : 'Edit ' + data.category?.name }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form" id="categoryForm" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="Household" autocomplete="off" />
          @if (form.controls.name.hasError('required')) { <mat-error>Name is required</mat-error> }
          @if (nameTaken()) { <mat-hint class="error">Another category already has this name.</mat-hint> }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>ID</mat-label>
          <input matInput [value]="id()" readonly />
          <mat-hint>{{ isNew ? 'Generated from the name. Receipts store this, so it can\\'t change later.' : 'Fixed once created — receipts reference it.' }}</mat-hint>
          @if (idTaken()) { <mat-hint class="error">A category with this ID already exists.</mat-hint> }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Keywords ({{ keywords().length }}/{{ maxKeywords }})</mat-label>
          <mat-chip-grid #chipGrid>
            @for (k of keywords(); track k) {
              <mat-chip-row (removed)="removeKeyword(k)" [class.conflict]="conflictOf(k)">
                {{ k }}
                <button matChipRemove [attr.aria-label]="'Remove ' + k"><mat-icon>cancel</mat-icon></button>
              </mat-chip-row>
            }
            <input placeholder="e.g. detergent — Enter, comma, or paste a list"
                   [matChipInputFor]="chipGrid"
                   [matChipInputSeparatorKeyCodes]="separators"
                   (matChipInputTokenEnd)="addKeyword($event)"
                   (paste)="onPaste($event)" />
          </mat-chip-grid>
          <mat-hint>Items whose name contains a keyword get this category. Matching ignores case.</mat-hint>
        </mat-form-field>

        @if (conflicts().length) {
          <p class="warn">
            <mat-icon>warning_amber</mat-icon>
            Also used by another category: {{ conflicts().join(', ') }}
          </p>
        }
        @if (keywords().length) {
          <button mat-button type="button" class="clear" (click)="keywords.set([])">Clear all keywords</button>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
      <button mat-flat-button type="submit" form="categoryForm" [disabled]="!canSave()">
        @if (saving()) { <mat-spinner diameter="18" /> } @else { Save }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 4px; min-width: min(520px, 80vw); padding-top: 8px; }
    .error { color: var(--rt-danger); }
    .warn { display: flex; gap: 6px; align-items: center; color: var(--rt-warning); font-size: 13px; margin: 8px 0 0; }
    .warn mat-icon { font-size: 18px; width: 18px; height: 18px; flex: none; }
    .conflict { --mat-chip-elevated-container-color: color-mix(in srgb, var(--rt-warning) 18%, transparent); }
    .clear { align-self: flex-start; }
    mat-chip-grid { max-height: 220px; overflow-y: auto; display: block; }
  `,
})
export class CategoryFormDialogComponent {
  protected readonly data = inject<CategoryFormData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CategoryFormDialogComponent, boolean>);

  protected readonly isNew = this.data.category === null;
  protected readonly separators = [ENTER, COMMA] as const;
  protected readonly maxKeywords = MAX_KEYWORDS;
  protected readonly saving = this.data.state.saving;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.category?.name ?? '', [Validators.required, Validators.maxLength(64)]],
  });
  protected readonly keywords = signal<string[]>([...(this.data.category?.keywords ?? [])]);

  private readonly name = toSignal(this.form.controls.name.valueChanges, { initialValue: this.form.controls.name.value });
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  private readonly originalId = this.data.category?.id ?? null;

  protected readonly id = computed(() => this.originalId ?? categoryIdOf(this.name()));
  protected readonly idTaken = computed(() => this.isNew && this.data.state.idTaken(this.id()));
  protected readonly nameTaken = computed(() => this.data.state.nameTaken(this.name(), this.originalId));

  /** Keywords in this draft that another category already uses. */
  private readonly otherKeywords = computed(() => {
    const owners = new Map<string, string>();
    for (const c of this.data.state.categories()) {
      if (c.id !== this.originalId) for (const k of c.keywords) owners.set(k, c.name);
    }
    return owners;
  });
  protected readonly conflicts = computed(() =>
    this.keywords().filter((k) => this.otherKeywords().has(k)).map((k) => `${k} (${this.otherKeywords().get(k)})`),
  );

  protected readonly canSave = computed(
    () =>
      this.status() === 'VALID' &&
      this.id().length > 0 &&
      !this.idTaken() &&
      !this.nameTaken() &&
      this.keywords().length <= MAX_KEYWORDS &&
      !this.saving(),
  );

  protected conflictOf(k: string): boolean {
    return this.otherKeywords().has(k);
  }

  protected addKeyword(event: MatChipInputEvent): void {
    if (event.value.trim()) this.keywords.update((list) => normalizeKeywords([...list, event.value]));
    event.chipInput.clear();
  }

  /** Pasting "milk, eggs, bread" or one-per-line adds them all at once. */
  protected onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!/[,\n]/.test(text)) return; // single word: let the chip input handle it
    event.preventDefault();
    this.keywords.update((list) => normalizeKeywords([...list, text]));
  }

  protected removeKeyword(k: string): void {
    this.keywords.update((list) => list.filter((x) => x !== k));
  }

  protected async submit(): Promise<void> {
    if (!this.canSave()) return;
    const ok = await this.data.state.upsert(
      { id: this.id(), name: this.form.controls.name.value.trim(), keywords: normalizeKeywords(this.keywords()) },
      this.originalId,
    );
    if (ok) this.dialogRef.close(true);
  }
}
