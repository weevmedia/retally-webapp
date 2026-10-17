import { FirebaseError } from 'firebase/app';

/** One error shape for the whole UI, whatever layer it came from. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = 'unknown',
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static from(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof FirebaseError) {
      return new AppError(friendlyMessage(error.code, error.message), error.code, error);
    }
    if (error instanceof Error) return new AppError(error.message, 'unknown', error);
    return new AppError('Something went wrong.', 'unknown', error);
  }
}

function friendlyMessage(code: string, fallback: string): string {
  switch (code) {
    case 'permission-denied':
    case 'functions/permission-denied':
      return 'You do not have permission to do that.';
    case 'unauthenticated':
    case 'functions/unauthenticated':
      return 'Your session expired. Please sign in again.';
    case 'functions/invalid-argument':
      return fallback.replace(/^.*?: /, '');
    case 'unavailable':
    case 'functions/unavailable':
      return 'The service is unavailable. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment or reset your password.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase.';
    default:
      return fallback || 'Something went wrong.';
  }
}
