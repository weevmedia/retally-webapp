import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { AuthService } from '@core/auth/auth.service';
import { NAV_ITEMS } from '@core/layout/nav-items';

/** Landing page. Live metrics (receipts/day, AI usage, sync failures) come with the Operations feature. */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, PageHeaderComponent],
  template: `
    <app-page-header [title]="greeting()" subtitle="Manage ReTally's data and master tables." />
    <div class="grid">
      @for (item of sections; track item.route) {
        <a class="tile" [routerLink]="item.comingSoon ? null : item.route" [class.disabled]="item.comingSoon">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span class="title">{{ item.label }}</span>
          <span class="sub">{{ item.comingSoon ? 'Coming soon' : 'Open' }}</span>
        </a>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .tile { background: var(--rt-surface); border-radius: 16px; box-shadow: var(--rt-shadow); padding: 20px;
            display: flex; flex-direction: column; gap: 6px; text-decoration: none; color: inherit; }
    .tile:hover:not(.disabled) { outline: 2px solid var(--rt-primary); }
    .tile mat-icon { color: var(--rt-primary); }
    .title { font-weight: 700; font-size: 16px; }
    .sub { color: var(--rt-muted); font-size: 13px; }
    .disabled { opacity: .55; cursor: default; }
  `,
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  protected readonly sections = NAV_ITEMS.filter((i) => i.route !== '/dashboard');
  protected readonly greeting = computed(() => {
    const name = this.auth.session()?.displayName?.split(' ')[0];
    return name ? `Hi, ${name}` : 'Welcome';
  });
}
