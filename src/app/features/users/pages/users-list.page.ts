import { ChangeDetectionStrategy, Component, effect, inject, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { NotificationService } from '@core/notifications/notification.service';
import { PageHeaderComponent } from '@shared/ui/page-header.component';
import { EmptyStateComponent } from '@shared/ui/empty-state.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '@shared/ui/confirm-dialog.component';
import {
  ActivityFilter, AppUser, SIGN_IN_OPTIONS, SignInFilter, StatusFilter, UserTab, deviceCounts, providerLabels, userLabel,
} from '../domain/user.model';
import { UsersStore } from '../state/users.store';
import { InviteAdminDialogComponent } from '../components/invite-admin.dialog';
import { UserDevicesDialogComponent } from '../components/user-devices.dialog';

/** App users and admins: search, filter, enable / disable, grant / revoke admin. */
@Component({
  selector: 'app-users-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, DecimalPipe, RouterLink, MatTableModule, MatSortModule, MatPaginatorModule, MatTabsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatTooltipModule, MatProgressBarModule, MatSlideToggleModule, PageHeaderComponent, EmptyStateComponent,
  ],
  template: `
    <app-page-header title="Users" subtitle="People using the ReTally app, and who can use this console.">
      <button mat-stroked-button (click)="state.load()" [disabled]="state.loading()"><mat-icon>refresh</mat-icon> Refresh</button>
      @if (state.tab() === 'admin') {
        <button mat-flat-button (click)="invite()"><mat-icon>person_add</mat-icon> Add admin</button>
      }
    </app-page-header>

    <mat-tab-group [selectedIndex]="state.tab() === 'admin' ? 1 : 0" (selectedIndexChange)="setTab($event)" animationDuration="0ms">
      <mat-tab [label]="'App users (' + state.appUsers().length + ')'" />
      <mat-tab [label]="'Admins (' + state.admins().length + ')'" />
    </mat-tab-group>

    <div class="stats">
      <div class="stat"><span class="value">{{ state.stats().total | number }}</span><span class="label">{{ state.tab() === 'admin' ? 'Admins' : 'Accounts' }}</span></div>
      <div class="stat"><span class="value">{{ state.stats().active30 | number }}</span><span class="label">Active in 30 days</span></div>
      <div class="stat"><span class="value" [class.warn]="state.stats().disabled > 0">{{ state.stats().disabled | number }}</span><span class="label">Disabled</span></div>
      @if (state.tab() === 'app') {
        <div class="stat"><span class="value">{{ state.stats().guests | number }}</span><span class="label">Guests</span></div>
      }
    </div>

    <div class="card">
      <div class="toolbar">
        <mat-form-field appearance="outline" class="grow" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <mat-label>Search name, email or user ID</mat-label>
          <input matInput [value]="state.filters().text" (input)="patch({ text: $any($event.target).value })" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w">
          <mat-label>Status</mat-label>
          <mat-select [value]="state.filters().status" (selectionChange)="patch({ status: $event.value })">
            <mat-option value="all">All</mat-option>
            <mat-option value="enabled">Enabled</mat-option>
            <mat-option value="disabled">Disabled</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w">
          <mat-label>Sign-in</mat-label>
          <mat-select [value]="state.filters().signIn" (selectionChange)="patch({ signIn: $event.value })">
            @for (o of signInOptions; track o.id) { <mat-option [value]="o.id">{{ o.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="w">
          <mat-label>Activity</mat-label>
          <mat-select [value]="state.filters().activity" (selectionChange)="patch({ activity: $event.value })">
            <mat-option value="all">Any time</mat-option>
            <mat-option value="7d">Active in 7 days</mat-option>
            <mat-option value="30d">Active in 30 days</mat-option>
            <mat-option value="inactive90">Inactive 90+ days</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (state.loading()) { <mat-progress-bar mode="indeterminate" /> }
      @if (state.truncated()) { <p class="banner">Showing the first 10,000 accounts.</p> }

      @if (state.error(); as error) {
        <app-empty-state icon="error_outline" title="Couldn't load users" [body]="error">
          <button mat-flat-button (click)="state.load()">Try again</button>
        </app-empty-state>
      } @else if (state.loaded() && state.visible().length === 0) {
        <app-empty-state icon="person_search" title="No users match" body="Try clearing the search or filters." />
      } @else if (state.loaded()) {
        <div class="table-wrap">
          <table mat-table [dataSource]="dataSource" matSort matSortActive="lastActiveAt" matSortDirection="desc">
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>User</th>
              <td mat-cell *matCellDef="let u">
                <div class="who">
                  @if (u.photoUrl) { <img class="avatar" [src]="u.photoUrl" alt="" referrerpolicy="no-referrer" /> }
                  @else { <span class="avatar initial">{{ initial(u) }}</span> }
                  <div class="names">
                    <strong>{{ label(u) }}</strong>
                    @if (u.uid === state.you()) { <span class="pill">You</span> }
                    @if (u.displayName && u.email) { <div class="sub">{{ u.email }}</div> }
                    <div class="sub mono">{{ u.uid }}</div>
                  </div>
                </div>
              </td>
            </ng-container>
            <ng-container matColumnDef="signIn">
              <th mat-header-cell *matHeaderCellDef>Sign-in</th>
              <td mat-cell *matCellDef="let u">
                @for (p of providers(u); track p) { <span class="tag">{{ p }}</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="receipts">
              <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="num">Receipts</th>
              <td mat-cell *matCellDef="let u" class="num">
                @if (u.receiptCount !== null) {
                  <a [routerLink]="['/receipts']" [queryParams]="{ user: u.email ?? u.uid, status: 'all' }" matTooltip="View their receipts">{{ u.receiptCount | number }}</a>
                } @else {
                  <a [routerLink]="['/receipts']" [queryParams]="{ user: u.email ?? u.uid, status: 'all' }" class="muted">View</a>
                }
              </td>
            </ng-container>
            <ng-container matColumnDef="devices">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Devices</th>
              <td mat-cell *matCellDef="let u">
                @if (u.devices.length) {
                  <button class="devices" (click)="showDevices(u)" [matTooltip]="u.devices[0].model + ' · last used'">
                    @for (c of counts(u.devices); track c.platform) {
                      <span class="dev"><mat-icon>{{ c.platform === 'ios' ? 'phone_iphone' : 'phone_android' }}</mat-icon>{{ c.count }}</span>
                    }
                  </button>
                } @else { <span class="muted">—</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Joined</th>
              <td mat-cell *matCellDef="let u" class="nowrap">{{ u.createdAt ? (u.createdAt | date: 'mediumDate') : '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="lastActiveAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Last active</th>
              <td mat-cell *matCellDef="let u" class="nowrap">{{ u.lastActiveAt ? (u.lastActiveAt | date: 'medium') : 'Never' }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Enabled</th>
              <td mat-cell *matCellDef="let u">
                <mat-slide-toggle [checked]="!u.disabled" [disabled]="state.isBusy(u.uid) || u.uid === state.you()"
                                  [matTooltip]="toggleTip(u)" (change)="toggle(u, $event.source)"
                                  [attr.aria-label]="(u.disabled ? 'Enable ' : 'Disable ') + label(u)">
                  {{ u.disabled ? 'Disabled' : 'Enabled' }}
                </mat-slide-toggle>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let u" class="actions">
                <button mat-icon-button [matMenuTriggerFor]="menu" aria-label="More actions" [disabled]="state.isBusy(u.uid)">
                  <mat-icon>more_vert</mat-icon></button>
                <mat-menu #menu="matMenu">
                  <a mat-menu-item [routerLink]="['/receipts']" [queryParams]="{ user: u.email ?? u.uid, status: 'all' }">
                    <mat-icon>receipt_long</mat-icon> View receipts</a>
                  @if (u.isAdmin) {
                    <button mat-menu-item [disabled]="u.uid === state.you()" (click)="confirmRevoke(u)">
                      <mat-icon>remove_moderator</mat-icon> Remove admin access</button>
                  } @else if (!u.anonymous) {
                    <button mat-menu-item (click)="confirmGrant(u)"><mat-icon>admin_panel_settings</mat-icon> Make admin</button>
                  }
                  <button mat-menu-item (click)="showDevices(u)"><mat-icon>devices</mat-icon> View devices</button>
                  <button mat-menu-item (click)="copy(u.uid)"><mat-icon>content_copy</mat-icon> Copy user ID</button>
                </mat-menu>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns(); sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns()" class="user-row" [class.off]="row.disabled"></tr>
          </table>
        </div>
        <mat-paginator [pageSizeOptions]="[25, 50, 100]" showFirstLastButtons />
      }
    </div>
  `,
  styles: `
    mat-tab-group { margin-bottom: 16px; }
    .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .stat { background: var(--rt-surface); border-radius: 14px; padding: 12px 18px; min-width: 130px;
            display: flex; flex-direction: column; box-shadow: var(--rt-shadow); }
    .value { font-size: 22px; font-weight: 700; }
    .value.warn { color: var(--rt-warning); }
    .label { color: var(--rt-muted); font-size: 13px; }
    .card { background: var(--rt-surface); border-radius: 16px; box-shadow: var(--rt-shadow); padding: 16px; }
    .toolbar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .grow { flex: 1 1 260px; }
    .w { width: 170px; }
    .banner { color: var(--rt-muted); font-size: 13px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; background: transparent; }
    td.mat-mdc-cell { vertical-align: middle; }
    .who { display: flex; gap: 10px; align-items: center; padding: 6px 0; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; flex: none; object-fit: cover; }
    .initial { display: grid; place-items: center; background: var(--rt-primary-tint); color: var(--rt-primary); font-weight: 700; }
    .names { min-width: 0; }
    .sub { color: var(--rt-muted); font-size: 12px; }
    .mono { font-family: ui-monospace, monospace; font-size: 11px; }
    .pill { font-size: 11px; padding: 1px 8px; border-radius: 999px; margin-left: 6px; background: var(--rt-primary); color: #fff; }
    .tag { display: inline-block; font-size: 12px; padding: 1px 8px; border-radius: 999px; margin: 1px 4px 1px 0;
           border: 1px solid var(--rt-divider); }
    .num { text-align: right; }
    .nowrap { white-space: nowrap; }
    .muted { color: var(--rt-muted); }
    .devices { all: unset; cursor: pointer; display: inline-flex; gap: 10px; }
    .devices:hover .dev { color: var(--rt-primary); }
    .dev { display: inline-flex; align-items: center; gap: 2px; font-weight: 600; }
    .dev mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .actions { text-align: right; width: 48px; }
    .user-row.off td { opacity: .55; }
    .user-row.off td.actions, .user-row.off td:has(mat-slide-toggle) { opacity: 1; }
    @media (max-width: 700px) { .w { width: 100%; } }
  `,
})
export class UsersListPage {
  protected readonly state = inject(UsersStore);
  private readonly dialog = inject(MatDialog);
  private readonly clipboard = inject(Clipboard);
  private readonly notifications = inject(NotificationService);

  protected readonly signInOptions = SIGN_IN_OPTIONS;
  protected readonly dataSource = new MatTableDataSource<AppUser>([]);
  protected readonly label = userLabel;
  protected readonly providers = providerLabels;

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    effect(() => {
      this.dataSource.data = this.state.visible();
    });
    effect(() => {
      const sort = this.sort();
      const paginator = this.paginator();
      if (sort) this.dataSource.sort = sort;
      if (paginator) this.dataSource.paginator = paginator;
    });
    this.dataSource.sortingDataAccessor = (u, col) => {
      switch (col) {
        case 'user': return userLabel(u).toLowerCase();
        case 'receipts': return u.receiptCount ?? -1;
        case 'devices': return u.devices.length;
        case 'createdAt': return u.createdAt ?? '';
        case 'lastActiveAt': return u.lastActiveAt ?? '';
        case 'status': return u.disabled ? 1 : 0;
        default: return '';
      }
    };
  }

  protected columns(): string[] {
    return this.state.tab() === 'admin'
      ? ['user', 'signIn', 'createdAt', 'lastActiveAt', 'status', 'actions']
      : ['user', 'signIn', 'receipts', 'devices', 'createdAt', 'lastActiveAt', 'status', 'actions'];
  }

  protected setTab(index: number): void {
    this.state.setTab((index === 1 ? 'admin' : 'app') as UserTab);
  }

  protected patch(change: Partial<{ text: string; status: StatusFilter; signIn: SignInFilter; activity: ActivityFilter }>): void {
    this.state.setFilters({ ...this.state.filters(), ...change });
  }

  protected initial(u: AppUser): string {
    return (u.displayName || u.email || '?').charAt(0).toUpperCase();
  }

  protected toggleTip(u: AppUser): string {
    if (u.uid === this.state.you()) return "You can't disable your own account";
    return u.disabled ? 'Enable this account' : 'Disable this account';
  }

  /** Toggle → confirm when disabling; the switch snaps back if cancelled or the call fails. */
  protected toggle(u: AppUser, toggle: { checked: boolean }): void {
    const disable = !toggle.checked;
    if (!disable) {
      void this.state.setDisabled(u, false).then((ok) => { if (!ok) toggle.checked = false; });
      return;
    }
    this.confirm({
      title: `Disable ${userLabel(u)}?`,
      message: u.isAdmin
        ? 'They will lose console access and be signed out within the hour. You can enable them again later.'
        : "They won't be able to sign in to the app and will be signed out within the hour. Their receipts are kept. You can enable them again later.",
      confirmLabel: 'Disable',
      destructive: true,
    }).subscribe((ok) => {
      if (!ok) {
        toggle.checked = true;
        return;
      }
      void this.state.setDisabled(u, true).then((done) => { if (!done) toggle.checked = true; });
    });
  }

  protected confirmGrant(u: AppUser): void {
    this.confirm({
      title: `Make ${userLabel(u)} an admin?`,
      message: 'They will be able to see all users and receipts and change master data in this console.',
      confirmLabel: 'Make admin',
    }).subscribe((ok) => ok && void this.state.setAdmin(u, true));
  }

  protected confirmRevoke(u: AppUser): void {
    this.confirm({
      title: `Remove admin access for ${userLabel(u)}?`,
      message: 'They will be signed out of the console within the hour. Their app account is not affected.',
      confirmLabel: 'Remove access',
      destructive: true,
    }).subscribe((ok) => ok && void this.state.setAdmin(u, false));
  }

  protected readonly counts = deviceCounts;

  protected showDevices(u: AppUser): void {
    this.dialog.open(UserDevicesDialogComponent, { data: u, autoFocus: false, maxWidth: '95vw' });
  }

  protected invite(): void {
    this.dialog.open(InviteAdminDialogComponent, { data: this.state, autoFocus: 'first-tabbable', maxWidth: '95vw' });
  }

  protected copy(value: string): void {
    this.clipboard.copy(value);
    this.notifications.success('Copied');
  }

  private confirm(data: ConfirmDialogData) {
    return this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data }).afterClosed();
  }
}
