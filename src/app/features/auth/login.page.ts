import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '@core/auth/auth.service';
import { AppError } from '@core/errors/app-error';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="wrap">
      <div class="card">
        <img class="logo" src="logo-128.png" alt="ReTally" width="64" height="64" />
        <h1>ReTally Admin</h1>

        @if (auth.isSignedIn() && !auth.isAdmin()) {
          <p class="warn">
            <mat-icon>lock</mat-icon>
            {{ auth.session()?.email }} doesn't have admin access.
          </p>
          <p class="muted">Ask an owner to grant it, then check again.</p>
          <div class="row">
            <button mat-flat-button (click)="recheck()" [disabled]="busy()">Check again</button>
            <button mat-button (click)="auth.signOut()">Use another account</button>
          </div>
        } @else {
          <p class="muted">Sign in with your admin account.</p>

          <form [formGroup]="form" class="form" (ngSubmit)="signInWithEmail()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" />
              @if (form.controls.email.hasError('email')) { <mat-error>Enter a valid email</mat-error> }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                     autocomplete="current-password" />
              <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())"
                      [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            <button mat-flat-button class="full" type="submit" [disabled]="busy() || form.invalid">
              <mat-icon>login</mat-icon> {{ busy() ? 'Signing in…' : 'Sign in' }}
            </button>
            <button mat-button type="button" class="forgot" (click)="resetPassword()" [disabled]="busy()">
              Forgot password?
            </button>
          </form>

          <div class="divider"><span>or</span></div>

          <button mat-stroked-button class="full" (click)="signInWithGoogle()" [disabled]="busy()">
            <mat-icon>account_circle</mat-icon> Sign in with Google
          </button>
        }
        @if (info()) { <p class="info">{{ info() }}</p> }
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
    .card { background: var(--rt-surface); border-radius: 20px; box-shadow: var(--rt-shadow);
            padding: 40px 32px; width: 100%; max-width: 400px; text-align: center; }
    .logo { display: block; width: 64px; height: 64px; margin: 0 auto 12px; }
    h1 { margin: 0 0 8px; }
    .muted { color: var(--rt-muted); margin: 0 0 24px; }
    .warn { display: flex; gap: 8px; align-items: center; justify-content: center; color: var(--rt-warning); font-weight: 600; }
    .row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .form { display: flex; flex-direction: column; text-align: left; }
    .full { width: 100%; height: 48px; }
    .forgot { align-self: center; margin-top: 4px; }
    .divider { display: flex; align-items: center; gap: 12px; margin: 16px 0; color: var(--rt-muted); font-size: 13px; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: currentColor; opacity: .3; }
    .info { color: var(--rt-muted); margin-top: 16px; }
    .error { color: var(--rt-danger); margin-top: 16px; }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async signInWithEmail(): Promise<void> {
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    await this.run(() => this.auth.signInWithEmail(email, password));
  }

  async signInWithGoogle(): Promise<void> {
    await this.run(() => this.auth.signInWithGoogle());
  }

  async resetPassword(): Promise<void> {
    const email = this.form.controls.email;
    if (!email.value || email.invalid) {
      email.markAsTouched();
      this.info.set(null);
      this.error.set('Enter your email above, then click "Forgot password?".');
      return;
    }
    await this.run(async () => {
      await this.auth.sendPasswordReset(email.value);
      this.info.set(`If ${email.value} has an account, a reset link is on its way.`);
    }, false);
  }

  async recheck(): Promise<void> {
    await this.run(() => this.auth.refreshClaims());
  }

  private async run(action: () => Promise<void>, navigate = true): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      await action();
      if (navigate && this.auth.isAdmin()) await this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(AppError.from(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
