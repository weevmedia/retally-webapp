# ReTally Admin (retally-webapp)

Web console for ReTally: review receipt data, manage users, and maintain master tables
(stores, logos, categories). Angular 21 + Angular Material + Firebase, deployed to
Firebase Hosting in the `retally-c5212` project.

## Quick start

```bash
npm install
npm start                 # http://localhost:4200
npm test                  # unit tests (Vitest)
npm run build             # production build → dist/retally-webapp/browser
npm run deploy            # Firebase Hosting (site: retally-admin)
```

Requires Node 20.19+, 22.12+ or 24+.

## One-time setup

1. **Web app config** — Firebase console → Project settings → *Your apps* → add a **Web** app
   ("ReTally Admin"). Copy `apiKey` and `appId` into `src/environments/environment.ts`.
2. **Google sign-in** — Firebase console → Authentication → Sign-in method → enable **Google**.
   Add `localhost` and your hosting domain to *Authorized domains*.
3. **Hosting site** — `firebase hosting:sites:create retally-admin` (gives
   `https://retally-admin.web.app`).
4. **Backend** (in `retally-mobile/backend`):
   ```bash
   cd functions && npm run build
   firebase deploy --only functions:adminUpsertStore,functions:adminDeleteStore --project retally-c5212
   cd ../firestore && firebase deploy --only firestore:rules,storage --project retally-c5212
   ```
5. **Grant yourself admin** — sign in to the console once (you'll see "no admin access"), then:
   ```bash
   cd retally-mobile/backend/functions
   gcloud auth application-default login
   node scripts/set-admin.mjs you@example.com
   ```
   Click **Check again** on the sign-in page.

## Architecture

```
src/app/
├── core/                    App-wide singletons — imported by features, never the reverse
│   ├── config/              AppConfig + APP_CONFIG token (typed environment)
│   ├── firebase/            provideFirebase(): SDK instances as DI tokens (+ emulator switch)
│   ├── auth/                AuthService (signals, admin claim) + route guards
│   ├── api/                 CallableApi — typed gateway to admin Cloud Functions
│   ├── errors/              AppError (one error shape) + GlobalErrorHandler
│   ├── notifications/       NotificationService (toasts)
│   └── layout/              Shell (side nav + top bar) and NAV_ITEMS
├── shared/ui/               Presentational building blocks (page header, empty state, dialogs)
└── features/<feature>/      One folder per bounded context, lazy-loaded
    ├── domain/              Models + pure rules (no Angular, no Firebase) — unit tested
    ├── data-access/         Repository port (abstract class) + Firestore adapter
    ├── state/               Signal-based store/facade — the only caller of the repository
    ├── components/          Dialogs and presentational pieces
    ├── pages/               Routed container components (read state, dispatch intents)
    └── <feature>.routes.ts  Lazy routes + feature-scoped providers
```

**Patterns used**

| Concern | Pattern |
|---|---|
| Modularity | Standalone components, lazy feature routes, path aliases (`@core`, `@shared`, `@features`, `@env`) |
| Dependency direction | `pages → state → data-access → domain`; features depend on `core`/`shared`, never on each other |
| Persistence | Repository pattern: `StoreRepository` (abstract) bound to `FirestoreStoreRepository` per route; swap for a fake in tests |
| State | Signal facades (`StoresStore`) scoped to the route; computed selectors; components are `OnPush` + zoneless |
| Commands vs queries | Reads stream from Firestore (admin-only rules); **all writes go through admin Cloud Functions** (CQRS-style) |
| Security | `admin` custom claim → `canMatch` guards (UI) **and** rules + functions (enforcement); audit log of every change |
| Errors | Everything becomes an `AppError`; uncaught errors reach `GlobalErrorHandler` → toast + console |
| Config | Typed `AppConfig` per environment via `fileReplacements`; Firebase SDK behind DI tokens |

**Adding a feature** (e.g. Categories): create `features/categories/{domain,data-access,state,pages}`,
export `CATEGORIES_ROUTES` with its providers, flip `comingSoon` off in `core/layout/nav-items.ts`,
and add the matching `admin*` callable in `backend/functions/src/admin`.

## Data touched

| Collection / path | Console access | Writes via |
|---|---|---|
| `store_icons/{key}` | read (admin rule) | `adminUpsertStore`, `adminDeleteStore` |
| Storage `store-icons/<key>.<ext>` | upload (admin rule) | browser, ≤ 1 MB images |
| `adminAudit/{id}` | read (admin rule) | functions only |

The mobile app keeps reading stores through `getStoreIcons`; keys are generated with the same
normalisation as the app's `iconKeyOf` (`domain/store.model.ts` — keep them in sync).
