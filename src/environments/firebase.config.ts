/**
 * Firebase web config for project retally-c5212, shared by every environment file.
 *
 * Firebase console → Project settings → General → "Your apps" → the "ReTally Admin" web app.
 * These values are public identifiers, not secrets — access is enforced by Firebase Auth,
 * the `admin` custom claim, security rules and the admin Cloud Functions.
 *
 * Kept in its own file because `environment.development.ts` replaces `environment.ts` at build
 * time (angular.json fileReplacements), so the development file must not import `./environment`.
 */
export const FIREBASE_WEB_CONFIG = {
  apiKey: 'AIzaSyDTC1NNY08goO3jqRgFACgF_uMw8SlImRc',
  authDomain: 'retally-c5212.firebaseapp.com',
  projectId: 'retally-c5212',
  storageBucket: 'retally-c5212.firebasestorage.app',
  appId: '1:124015205685:web:37d9c059730359b24f407c',
};
