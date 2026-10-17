import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, getAuth } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';
import { APP_CONFIG, AppConfig } from '@core/config/app-config';

/*
 * Firebase SDK handles exposed as DI tokens. Features never call `getAuth()` etc. directly,
 * which keeps them testable (swap a token in a spec) and keeps SDK set-up in one place.
 */
export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP');
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH');
export const FIRESTORE = new InjectionToken<Firestore>('FIRESTORE');
export const FIREBASE_STORAGE = new InjectionToken<FirebaseStorage>('FIREBASE_STORAGE');
export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>('FIREBASE_FUNCTIONS');

export function provideFirebase(config: AppConfig): EnvironmentProviders {
  const app = initializeApp(config.firebase);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);
  const functions = getFunctions(app, config.functionsRegion);

  if (config.useEmulators) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }

  return makeEnvironmentProviders([
    { provide: APP_CONFIG, useValue: config },
    { provide: FIREBASE_APP, useValue: app },
    { provide: FIREBASE_AUTH, useValue: auth },
    { provide: FIRESTORE, useValue: firestore },
    { provide: FIREBASE_STORAGE, useValue: storage },
    { provide: FIREBASE_FUNCTIONS, useValue: functions },
  ]);
}
