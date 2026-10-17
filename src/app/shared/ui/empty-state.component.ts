import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="empty">
      <mat-icon>{{ icon() }}</mat-icon>
      <h3>{{ title() }}</h3>
      @if (body()) { <p>{{ body() }}</p> }
      <ng-content />
    </div>
  `,
  styles: `
    .empty { text-align: center; padding: 48px 16px; color: var(--rt-muted); }
    mat-icon { font-size: 48px; width: 48px; height: 48px; color: var(--rt-primary); }
    h3 { color: var(--rt-ink); margin: 12px 0 4px; }
    p { margin: 0 0 16px; }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly body = input('');
}
