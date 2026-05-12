# BurnRate v3 — Architecture (1-page)

BurnRate is a single-user Next.js 16 (App Router) app that stores everything in the user's browser. There is no server-side state — every "feature" is just a pure module operating on `BurnRateData`-shaped values.

## Runtime data flow

```
┌────────────────────────────────────────────────────────────────────┐
│                            Browser tab                             │
│                                                                    │
│   localStorage                                                     │
│   ├─ burnrate.subscriptions.v1                                     │
│   ├─ burnrate.trials.v1                                            │
│   ├─ burnrate.budget.v1                                            │
│   ├─ burnrate.theme.v1                                             │
│   ├─ burnrate.trialAlertsDismissed.v1                              │
│   ├─ burnrate.preferences.v1                ← v3 (base currency,   │
│   │                                            FX overrides, lock) │
│   ├─ burnrate.ledger.v1                     ← v3 (cancellations)   │
│   ├─ burnrate.vault.v1                      ← v3 (passphrase meta) │
│   └─ burnrate.recommendations.dismissed.v1  ← v3                   │
│                                                                    │
│   IndexedDB (db `burnrate`, v1)             ← v3                   │
│   └─ snapshots [keyPath: snapshotMonth]                            │
│                                                                    │
│           │                                                        │
│           ▼ useLocalStorage hook + lib/idb.ts                      │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  BurnRateApp.tsx — stateful client orchestrator          │     │
│   │   ├─ Dashboard ─ HeroMetrics, Donut, Insights, Renewals  │     │
│   │   ├─ BudgetTracker                                       │     │
│   │   ├─ PendingCancellations         ← v3                   │     │
│   │   ├─ SmarterAlternatives          ← v3                   │     │
│   │   ├─ TrendsPanel                  ← v3                   │     │
│   │   ├─ SavingsLedger                ← v3                   │     │
│   │   ├─ SubscriptionManager (CRUD + currency + cancel-on)   │     │
│   │   ├─ TrialTracker (CRUD + countdowns)                    │     │
│   │   ├─ Simulator                                           │     │
│   │   ├─ CurrencySettings             ← v3                   │     │
│   │   ├─ SecuritySettings + LockScreen ← v3                  │     │
│   │   ├─ ChargesImporter              ← v3                   │     │
│   │   ├─ ShareAndData (Backup / Sync / Share / Danger)       │     │
│   │   ├─ PopularServicesPicker                               │     │
│   │   ├─ CommandPalette (Cmd/Ctrl-K)                         │     │
│   │   ├─ SyncModal (#sync= hash handler — BR1 and BR2)       │     │
│   │   └─ ServiceWorkerRegistrar                              │     │
│   └──────────────────────────────────────────────────────────┘     │
│           │                                                        │
│           ▼ pure logic (src/lib/*)                                 │
│   ┌──────────────────────────────────────────────────────────┐     │
│   │  burnrate.ts        — money math, CSV, insights, metrics │     │
│   │  currency.ts        — convert, format, FX context  ← v3  │     │
│   │  ics.ts             — RFC 5545 calendar serializer       │     │
│   │  sync.ts            — BR1./BR2. lz-string + checksum     │     │
│   │  budget.ts          — cap/savings progress               │     │
│   │  ledger.ts          — savings ledger + due-sweep   ← v3  │     │
│   │  recommendations.ts — bundle + overlap detector    ← v3  │     │
│   │  snapshots.ts       — IDB-backed monthly capture   ← v3  │     │
│   │  idb.ts             — tiny IndexedDB wrapper       ← v3  │     │
│   │  charges.ts         — paste parser                 ← v3  │     │
│   │  charge-matcher.ts  — fuzzy match against catalog  ← v3  │     │
│   │  crypto.ts          — PBKDF2 + AES-GCM helpers     ← v3  │     │
│   │  preferences.ts     — preferences normalizer      ← v3   │     │
│   │  migrate.ts         — v2→v3 record migration      ← v3   │     │
│   │  dataActions.ts     — file download + clipboard helpers  │     │
│   └──────────────────────────────────────────────────────────┘     │
│           │                                                        │
│           ▼ generated at request time                              │
│   /s/[payload]/page.tsx          — read-only public share          │
│   /s/[payload]/opengraph-image   — dynamic OG (next/og)            │
│   /manifest.webmanifest          — PWA manifest                    │
│   /sw.js                         — service worker (precache)       │
└────────────────────────────────────────────────────────────────────┘
```

## Key decisions

- **Schema bump to v3.** `SCHEMA_VERSION = 3` (`src/lib/migrate.ts`). `Subscription` and `Trial` gained optional `currency` (default USD on read); `Subscription` gained optional `cancellingOn`. `BurnRateData` carries optional `preferences`, `ledger`, and `snapshots` slices. v2 storage hydrates cleanly without migration logic on the per-key reads.
- **Sync prefix bump to `BR2.`** to carry preferences + per-record currency. v1 payloads (`BR1.`) still decode forever — receiver treats missing currency as USD.
- **No FX API.** A static rate table snapshotted on 2026-05-01 ships in `src/data/fx-rates.ts`. Users override per-currency from Settings; overrides persist in `burnrate.preferences.v1`.
- **Encryption boundary.** WebCrypto AES-GCM wraps localStorage values when the vault is enabled. Sync and share links remain cleartext — the receiving device can't decrypt otherwise. Generation flows show explicit warnings.
- **IDB for time-series only.** Subs/trials/ledger stay in localStorage (small, fast). Snapshots live in IndexedDB because they grow over time and don't need sync-payload inclusion.
- **One big app component (still).** `BurnRateApp.tsx` orchestrates all state. The v2 follow-up `useBurnRateState` extraction is still queued — see `docs/v3-progress.md`.

## Testing strategy

- **Unit tests** for every `src/lib/*` module (currency, ledger, snapshots, recommendations, charges, charge-matcher, crypto, plus carry-overs ICS, sync, budget, CSV, burnrate domain).
- **Component tests** for `CommandPalette`, `PopularServicesPicker`, and `BurnRateApp` (multiple files cover budget, sync, palette, popular, ICS, and original flows).
- **Playwright smoke (v3)** at `tests/e2e/` — runnable locally against `npm run dev`. Not wired into CI for v3.
- `console.error` and `console.warn` cause a test failure — silent regressions get caught.
