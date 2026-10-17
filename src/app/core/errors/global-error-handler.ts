import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';
import { AppError } from './app-error';
import { NotificationService } from '@core/notifications/notification.service';

/** Last line of defence: anything uncaught is logged and shown as a toast instead of failing silently. */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notifications = inject(NotificationService);
  private readonly zone = inject(NgZone);

  handleError(error: unknown): void {
    const appError = AppError.from((error as { rejection?: unknown })?.rejection ?? error);
    console.error('[ReTallyAdmin]', appError.code, appError.cause ?? appError);
    this.zone.run(() => this.notifications.error(appError.message));
  }
}
