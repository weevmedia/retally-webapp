import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '@core/auth/auth.service';
import { APP_CONFIG } from '@core/config/app-config';
import { NAV_ITEMS } from './nav-items';

/** Authenticated frame: side navigation, top bar with the account menu, routed content. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule, MatMenuModule,
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset()"
        #drawer
        class="nav">
        <div class="brand">
          <img class="logo" src="logo-128.png" alt="" width="32" height="32" />
          <span>{{ appName }}</span>
        </div>
        <mat-nav-list>
          @for (item of navItems; track item.route) {
            <a mat-list-item
               [routerLink]="item.route"
               routerLinkActive="active"
               [disabled]="item.comingSoon"
               (click)="isHandset() && drawer.close()">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
              @if (item.comingSoon) { <span matListItemMeta class="soon">Soon</span> }
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          @if (isHandset()) {
            <button mat-icon-button (click)="drawer.toggle()" aria-label="Menu"><mat-icon>menu</mat-icon></button>
          }
          <span class="spacer"></span>
          <button mat-button [matMenuTriggerFor]="account" class="account">
            <mat-icon>account_circle</mat-icon>
            <span class="email">{{ email() }}</span>
          </button>
          <mat-menu #account="matMenu">
            <button mat-menu-item (click)="signOut()">
              <mat-icon>logout</mat-icon><span>Sign out</span>
            </button>
          </mat-menu>
        </mat-toolbar>
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .shell { height: 100vh; }
    .nav { width: 240px; border-right: 1px solid var(--rt-divider); }
    .brand { display: flex; align-items: center; gap: 10px; padding: 20px 16px; font-weight: 700; font-size: 18px; }
    .logo { display: block; width: 32px; height: 32px; flex: none; }
    .active { background: var(--rt-primary-tint); }
    .soon { font-size: 11px; color: var(--rt-muted); }
    .topbar { background: transparent; position: sticky; top: 0; z-index: 2; }
    .spacer { flex: 1; }
    .email { margin-left: 6px; }
    @media (max-width: 599px) { .email { display: none; } }
    .content { padding: 8px 24px 32px; max-width: 1280px; }
    @media (max-width: 599px) { .content { padding: 8px 16px 24px; } }
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly appName = inject(APP_CONFIG).appName;
  protected readonly navItems = NAV_ITEMS;
  protected readonly email = computed(() => this.auth.session()?.email ?? '');
  protected readonly isHandset = toSignal(
    inject(BreakpointObserver).observe('(max-width: 959px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }
}
