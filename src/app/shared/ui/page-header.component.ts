import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title + subtitle, with projected actions on the right. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) { <p>{{ subtitle() }}</p> }
      </div>
      <div class="actions"><ng-content /></div>
    </header>
  `,
  styles: `
    .header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
              flex-wrap: wrap; margin: 8px 0 20px; }
    h1 { margin: 0; font-size: 28px; font-weight: 700; }
    p { margin: 4px 0 0; color: var(--rt-muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
