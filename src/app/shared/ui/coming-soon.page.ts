import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageHeaderComponent } from './page-header.component';
import { EmptyStateComponent } from './empty-state.component';

/** Placeholder for features on the roadmap (route data: { title, icon, body }). */
@Component({
  selector: 'app-coming-soon-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header [title]="data['title']" />
    <app-empty-state [icon]="data['icon']" title="Coming soon" [body]="data['body']" />
  `,
})
export class ComingSoonPage {
  protected readonly data = inject(ActivatedRoute).snapshot.data;
}
