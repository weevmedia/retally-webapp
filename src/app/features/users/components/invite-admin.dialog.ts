import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Clipboard } from '@angular/cdk/clipboard';
import { NotificationService } from '@core/notifications/notification.service';
import { InviteResult } from '../data-access/user.repository';
import { UsersStore } from '../state/users.store';

/** Adds an admin by email; for new accounts, shows the set-password link to share. */
@Component({
  selector: 'app-invite-admin-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>Add admin</h2>
    <mat-dialog-content>
      @if (result(); as r) {
        <p class="done"><mat-icon>check_circle</mat-icon> {{ r.user.email }} can now use the console.</p>
        @if (r.passwordLink) {
          <p>{{ r.created ? 'A new account was created.' : 'They already had an email account.' }}
            Send them this link to {{ r.created ? 'set' : 'reset' }} their password — it isn't emailed automatically:</p>
          <div class="link">
            <input readonly [value]="r.passwordLink" (focus)="$any($event.target).select()" aria-label="Set-password link" />
            <button mat-stroked-button (click)="copy(r.passwordLink)"><mat-icon>content_copy</mat-icon> Copy</button>
          </div>
          <p class="muted">They can also just click <strong>Sign in with Google</strong> if that email is a Google account.</p>
        } @else {
          <p class="muted">They sign in with their existing account. If they're signed in already, they should sign out and back in.</p>
        }
      } @else {
        <p class="muted">Gives console access to this email. If no account exists, one is created and you get a link for them to set a password.</p>
        <form (ngSubmit)="submit()" id="inviteForm">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Email</mat-label>
            <input matInput type="email" [formControl]="email" autocomplete="off" />
            @if (email.hasError('email')) { <mat-error>Enter a valid email</mat-error> }
          </mat-form-field>
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (result()) {
        <button mat-flat-button mat-dialog-close>Done</button>
      } @else {
        <button mat-button mat-dialog-close [disabled]="saving()">Cancel</button>
        <button mat-flat-button type="submit" form="inviteForm" [disabled]="email.invalid || saving()">
          @if (saving()) { <mat-spinner diameter="18" /> } @else { Add admin }
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .full { width: min(440px, 80vw); }
    .muted { color: var(--rt-muted); font-size: 13px; }
    .done { display: flex; gap: 8px; align-items: center; font-weight: 600; }
    .done mat-icon { color: var(--rt-primary); }
    .link { display: flex; gap: 8px; align-items: center; }
    .link input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--rt-divider); border-radius: 8px;
                  font: 12px ui-monospace, monospace; background: var(--rt-background); color: inherit; }
  `,
})
export class InviteAdminDialogComponent {
  private readonly state = inject<UsersStore>(MAT_DIALOG_DATA);
  private readonly clipboard = inject(Clipboard);
  private readonly notifications = inject(NotificationService);

  protected readonly email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected readonly saving = signal(false);
  protected readonly result = signal<InviteResult | null>(null);

  protected async submit(): Promise<void> {
    if (this.email.invalid || this.saving()) return;
    this.saving.set(true);
    const result = await this.state.inviteAdmin(this.email.value.trim());
    this.saving.set(false);
    if (result) this.result.set(result);
  }

  protected copy(link: string): void {
    this.clipboard.copy(link);
    this.notifications.success('Link copied');
  }
}
