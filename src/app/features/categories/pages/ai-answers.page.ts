import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { DEFAULT_CATEGORIES } from '../domain/category.model';
import { ItemAliasesStore } from '../state/item-aliases.store';

/**
 * Review what the AI decided for each receipt line (shared by all users) and fix wrong ones.
 * An override applies to every future scan and to the app's one-time re-categorisation;
 * items already on phones keep their category until the app asks again.
 */
@Component({
  selector: 'app-ai-answers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, RouterLink, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatProgressBarModule, PageHeaderComponent, EmptyStateComponent,
  ],
  template: `
    <app-page-header title="AI answers" subtitle="How the AI categorised each receipt line. Fix a wrong one and every future scan uses your answer.">
      <a mat-stroked-button routerLink="/categories"><mat-icon>arrow_back</mat-icon> Categories</a>
    </app-page-header>

    <div class="card">
      <div class="filters">
        <mat-form-field appearance="outline" class="search" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Receipt text starts with…</mat-label>
          <input matInput [value]="state.search()" (change)="state.setSearch($any($event.target).value)"
                 (keyup.enter)="state.setSearch($any($event.target).value)" placeholder="tide pds" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Category</mat-label>
          <mat-select [value]="state.category()" (selectionChange)="state.setCategory($event.value)">
            <mat-option value="">All</mat-option>
            @for (c of categories; track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>

      @if (state.loading()) { <mat-progress-bar mode="indeterminate" /> }

      @if (state.error(); as error) {
        <app-empty-state icon="error_outline" title="Couldn't load AI answers" [body]="error" />
      } @else if (!state.loading() && state.rows().length === 0) {
        <app-empty-state icon="auto_awesome" title="Nothing here yet"
                         body="Answers appear after the app asks the AI to categorise scanned items." />
      } @else {
        <table class="table">
          <thead><tr><th>Receipt text</th><th>Product</th><th>Category</th><th class="when">Updated</th></tr></thead>
          <tbody>
            @for (row of state.rows(); track row.raw) {
              <tr>
                <td class="raw">{{ row.raw }}</td>
                <td class="muted">{{ row.name ?? 'not a product' }}</td>
                <td>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="pick">
                    <mat-select [value]="row.category" [disabled]="state.saving() === row.raw"
                                (selectionChange)="state.override(row, $event.value)">
                      @for (c of categories; track c.id) { <mat-option [value]="c.id">{{ c.name }}</mat-option> }
                    </mat-select>
                  </mat-form-field>
                  @if (row.overridden) {
                    <span class="pill" [matTooltip]="row.overriddenBy ? 'Set by ' + row.overriddenBy : ''">Fixed by admin</span>
                  }
                </td>
                <td class="when muted">{{ row.categorizedAt ? (row.categorizedAt | date: 'MMM d, y') : '' }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (state.hasMore()) {
          <div class="more"><button mat-stroked-button (click)="state.loadMore()" [disabled]="state.loading()">Load more</button></div>
        }
      }
    </div>
  `,
  styles: `
    .card { background: var(--rt-surface); border-radius: 16px; box-shadow: var(--rt-shadow); padding: 16px; }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .search { flex: 1; min-width: 240px; max-width: 420px; }
    .table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 12px; color: var(--rt-muted); font-weight: 600; padding: 8px; }
    td { padding: 6px 8px; border-top: 1px solid var(--rt-divider); vertical-align: middle; }
    .raw { font-family: ui-monospace, monospace; font-size: 13px; }
    .muted { color: var(--rt-muted); font-size: 13px; }
    .pick { width: 190px; }
    .pill { margin-left: 8px; background: var(--rt-primary-tint); color: var(--rt-primary); font-size: 11px;
            font-weight: 600; padding: 2px 8px; border-radius: 999px; }
    .more { display: flex; justify-content: center; padding-top: 12px; }
    @media (max-width: 700px) { .when { display: none; } }
  `,
})
export class AiAnswersPage {
  protected readonly state = inject(ItemAliasesStore);
  /** Every category the AI can pick (not "Uncategorized", which it never returns). */
  protected readonly categories = DEFAULT_CATEGORIES.filter((c) => c.id !== 'uncategorized');
}
