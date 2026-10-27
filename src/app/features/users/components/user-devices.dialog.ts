import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Clipboard } from '@angular/cdk/clipboard';
import { NotificationService } from '@core/notifications/notification.service';
import { AppUser, osLabel, userLabel } from '../domain/user.model';

/** Every app install a user has, newest activity first. */
@Component({
  selector: 'app-user-devices-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>Devices · {{ label(user) }}</h2>
    <mat-dialog-content>
      @if (user.devices.length === 0) {
        <p class="muted">No devices reported yet. The app reports its device after sign-in, from the version with device tracking onward.</p>
      } @else {
        <ul class="list">
          @for (d of user.devices; track d.installationId) {
            <li>
              <mat-icon class="icon">{{ d.platform === 'ios' ? 'phone_iphone' : 'phone_android' }}</mat-icon>
              <div class="body">
                <strong>{{ d.model }}</strong>
                <div class="sub">{{ os(d) }} · App {{ d.appVersion || '—' }}</div>
                <div class="sub">
                  Last seen {{ d.lastSeenAt ? (d.lastSeenAt | date: 'medium') : '—' }}
                  · First seen {{ d.firstSeenAt ? (d.firstSeenAt | date: 'mediumDate') : '—' }}
                </div>
                <button class="id" (click)="copy(d.installationId)" matTooltip="Copy install ID">{{ d.installationId }}</button>
              </div>
            </li>
          }
        </ul>
        <p class="muted">A reinstall gets a new install ID, so old entries can be the same phone.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-flat-button mat-dialog-close>Close</button></mat-dialog-actions>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; min-width: min(460px, 80vw); }
    li { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--rt-divider); }
    li:last-child { border-bottom: none; }
    .icon { color: var(--rt-primary); flex: none; }
    .body { min-width: 0; }
    .sub, .muted { color: var(--rt-muted); font-size: 13px; }
    .id { all: unset; cursor: pointer; font: 11px ui-monospace, monospace; color: var(--rt-muted); margin-top: 2px; }
    .id:hover { text-decoration: underline; }
  `,
})
export class UserDevicesDialogComponent {
  protected readonly user = inject<AppUser>(MAT_DIALOG_DATA);
  private readonly clipboard = inject(Clipboard);
  private readonly notifications = inject(NotificationService);
  protected readonly label = userLabel;
  protected readonly os = osLabel;

  protected copy(value: string): void {
    this.clipboard.copy(value);
    this.notifications.success('Copied');
  }
}
