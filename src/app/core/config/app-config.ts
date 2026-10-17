import { InjectionToken } from '@angular/core';

/** Typed runtime configuration, provided once from the active environment file. */
export interface AppConfig {
  production: boolean;
  appName: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    appId: string;
  };
  /** Region the Cloud Functions are deployed to (must match the backend's REGION). */
  functionsRegion: string;
  useEmulators: boolean;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
