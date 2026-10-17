import { AppConfig } from '@core/config/app-config';
import { FIREBASE_WEB_CONFIG } from './firebase.config';

/** Production configuration (`ng build`). */
export const environment: AppConfig = {
  production: true,
  appName: 'ReTally Admin',
  firebase: FIREBASE_WEB_CONFIG,
  functionsRegion: 'us-east1',
  useEmulators: false,
};
