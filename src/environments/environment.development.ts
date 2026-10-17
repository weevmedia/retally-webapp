import { AppConfig } from '@core/config/app-config';
import { FIREBASE_WEB_CONFIG } from './firebase.config';

/**
 * `ng serve` configuration. Set `useEmulators: true` to run against the local Firebase emulators.
 *
 * This file replaces `environment.ts` at build time, so it must not import `./environment`:
 * that import would resolve back to this file and leave the config undefined (blank page).
 */
export const environment: AppConfig = {
  production: false,
  appName: 'ReTally Admin',
  firebase: FIREBASE_WEB_CONFIG,
  functionsRegion: 'us-east1',
  useEmulators: false,
};
