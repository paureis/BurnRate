# BurnRate v6 — Architecture (1-page)

BurnRate is a single-user Next.js 16 (App Router) app that stores everything in the user's browser. There is no server-side state — the only server work is the stateless `/s/[payload]/calendar.ics` route, which derives its output purely from the URL payload. Every "feature" is a pure module operating on `BurnRateData`-shaped values.

## Runtime data flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Browser tab                               │
│                                                                        │
│   localStorage                                                         │
│   ├─ burnrate.subscriptions.v1                                         │
│   ├─ burnrate.trials.v1                                                │
│   ├─ burnrate.budget.v1                       (legacy; v6 hydrates     │
│   │                                            into goals.v2)          │
│   ├─ burnrate.theme.v1                                                 │
│   ├─ burnrate.trialAlertsDismissed.v1                                  │
│   ├─ burnrate.preferences.v1                  (base ccy, FX overrides, │
│   │                                            dashboardLayout, lock,  │
│   │                                            usageNudge, reports)    │
│   ├─ burnrate.ledger.v1                                                │
│   ├─ burnrate.vault.v1                        (passphrase + decoy meta)│
│   ├─ burnrate.recommendations.dismissed.v1                             │
│   ├─ burnrate.views.v1                        ← v4 (saved views)       │
│   ├─ burnrate.categories.v1                   ← v4 (custom cats)       │
│   ├─ burnrate.history.v1                      ← v4 (20-entry audit)    │
│   ├─ burnrate.dashboard-layout.v1             ← v4                     │
│   ├─ burnrate.goals.v2                        ← v5 (goal engine)       │
│   ├─ burnrate.cancellation-attempts.v1        ← v5                     │
│   ├─ burnrate.notify.v1                       ← v6 (channels, quiet hrs)│
│   ├─ burnrate.profiles.v1                     ← v6 (household)         │
│   └─ burnrate.vault-registry.v1               ← v6 (multi-vault index) │
│                                                                        │
│   IndexedDB (db `burnrate`, v1)                                        │
│   └─ snapshots [keyPath: snapshotMonth]                                │
│                                                                        │
│   v6 namespace plan (deferred execution): every per-vault key migrates │
│   to `burnrate.vault.<vaultId>.<slot>.<key>` where <slot> ∈ real|decoy.│
│   `planV5toV6Migration` is shipped and unit-tested; rewrite runs once  │
│   on first v6 boot once wired.                                         │
│                                                                        │
│           │                                                            │
│           ▼ useLocalStorage hook + lib/idb.ts                          │
│   ┌────────────────────────────────────────────────────────────┐       │
│   │  BurnRateApp.tsx — stateful client orchestrator            │       │
│   │   ├─ Dashboard ─ HeroMetrics, Donut, Insights, Renewals    │       │
│   │   ├─ BudgetTracker / GoalsPanel              ← v5/v6       │       │
│   │   ├─ PendingCancellations                                  │       │
│   │   ├─ SmarterAlternatives                                   │       │
│   │   ├─ TrendsPanel                  (forecast bends on       │       │
│   │   │                                scheduled price changes)│       │
│   │   ├─ SavingsLedger                                         │       │
│   │   ├─ UsageInsights                ← v5 (hero/zombie/ghost) │       │
│   │   ├─ ChargeCalendarPanel          ← v5 (heatmap)           │       │
│   │   ├─ RetentionLog                 ← v5 (active discounts)  │       │
│   │   ├─ PerProfileBurn               ← v6 (per-profile burn)  │       │
│   │   ├─ SubscriptionManager + BulkActionBar + TagInput        │       │
│   │   │                                + SavedViewsPills       │       │
│   │   │                                + PriceChangeEditor     │       │
│   │   ├─ TrialTracker                                          │       │
│   │   ├─ Simulator                                             │       │
│   │   ├─ CurrencySettings                                      │       │
│   │   ├─ SecuritySettings + LockScreen + DecoySetup            │       │
│   │   ├─ ProfileSettings              ← v4 (.burnprofile)      │       │
│   │   ├─ CategorySettings             ← v4                     │       │
│   │   ├─ DashboardLayoutEditor        ← v4                     │       │
│   │   ├─ NotificationSettings         ← v6                     │       │
│   │   ├─ ProfilesPanel + VaultManager ← v6                     │       │
│   │   ├─ HistoryDrawer                ← v4 (undo)              │       │
│   │   ├─ CancellationCoach            ← v5 (drawer + playbooks)│       │
│   │   ├─ ChargesImporter                                       │       │
│   │   ├─ ShareAndData (Backup / Sync / Share / Live Calendar / │       │
│   │   │                                Encrypted share / Danger)│       │
│   │   ├─ PeerSyncFlow                 ← v6 (WebRTC + QR)       │       │
│   │   ├─ PopularServicesPicker                                 │       │
│   │   ├─ CommandPalette (Cmd/Ctrl-K + structured operators)    │       │
│   │   ├─ SyncModal (#sync= handler — BR1.–BR5./BR5E.)          │       │
│   │   └─ ServiceWorkerRegistrar                                │       │
│   └────────────────────────────────────────────────────────────┘       │
│           │                                                            │
│           ▼ pure logic (src/lib/*)                                     │
│   ┌────────────────────────────────────────────────────────────┐       │
│   │  burnrate.ts        — money math, CSV, insights, metrics   │       │
│   │  currency.ts        — convert, format, FX context          │       │
│   │  ics.ts             — RFC 5545 calendar serializer         │       │
│   │  sync.ts            — BR1.–BR5. lz-string + checksum       │       │
│   │  budget.ts          — legacy cap/savings (read on migrate) │       │
│   │  ledger.ts          — savings ledger + due-sweep           │       │
│   │  recommendations.ts — bundle + overlap detector            │       │
│   │  snapshots.ts       — IDB-backed monthly capture           │       │
│   │  idb.ts             — tiny IndexedDB wrapper               │       │
│   │  charges.ts         — paste parser                         │       │
│   │  charge-matcher.ts  — fuzzy match against catalog          │       │
│   │  crypto.ts          — PBKDF2 + AES-GCM helpers             │       │
│   │  preferences.ts     — preferences normalizer               │       │
│   │  dataActions.ts     — file download + clipboard helpers    │       │
│   │  migrate.ts         — SCHEMA_VERSION=6, v2→v6 record migr. │       │
│   │  ── v4 ─────────────────────────────────────────────────── │       │
│   │  bulk.ts            — pure applyBulkPatch / applyBulkDelete│       │
│   │  tags.ts            — normalizeTag / mergeTags             │       │
│   │  views.ts           — SavedView + applyView                │       │
│   │  dashboard-layout.ts — resolve + reorder helpers           │       │
│   │  palette-query.ts   — `cost:>20 cycle:yearly tag:x` parser │       │
│   │  history.ts         — 20-entry ring buffer, 8 KB cap       │       │
│   │  categories.ts      — CategoryDef registry + resolve       │       │
│   │  profile.ts         — .burnprofile export/import           │       │
│   │  ── v5 ─────────────────────────────────────────────────── │       │
│   │  usage.ts           — ROI scoring (hero/zombie/ghost…)     │       │
│   │  price-changes.ts   — applyDue + projectMonthlyBurn        │       │
│   │  charge-calendar.ts — heatmap derivation + summary         │       │
│   │  discounts.ts       — retention-log savings math           │       │
│   │  annual-report.ts   — /report/[year] data assembly         │       │
│   │  goals.ts           — Goal engine v2 + evaluateGoals       │       │
│   │  cancellation-attempts.ts — coach attempt log              │       │
│   │  ── v6 ─────────────────────────────────────────────────── │       │
│   │  profiles.ts        — owners[] + splitMonthlyBurn          │       │
│   │  peer-sync.ts       — RTCPeerConnection offer/answer flow  │       │
│   │  qrcode.ts          — from-scratch QR v1–v10 SVG encoder   │       │
│   │  crypto-share.ts    — ENC2./BR5E. envelope wrapper         │       │
│   │  decoy.ts           — duress-passphrase routing            │       │
│   │  notify.ts          — scheduleAll + prune + permission     │       │
│   │  vault-registry.ts  — namespacedKey + v5→v6 migration plan │       │
│   └────────────────────────────────────────────────────────────┘       │
│           │                                                            │
│           │   ── seed data ───────────────────────────────────         │
│           │   src/data/cancellation-playbooks.ts  — 20 playbooks       │
│           │   src/data/fx-rates.ts                — 2026-05-01 snapshot│
│           │   src/data/popularServices.ts         — picker catalog     │
│           │                                                            │
│           ▼ generated at request time                                  │
│   /                          — home (BurnRateApp client component)     │
│   /s/[payload]/page.tsx      — read-only public share (BR2.–BR5.;      │
│   /                            BR5E. shows passphrase prompt)          │
│   /s/[payload]/opengraph-image — dynamic OG (next/og); generic card    │
│   /                              for BR5E.                             │
│   /s/[payload]/calendar.ics  — ICS route handler, force-dynamic,       │
│   /                            Cache-Control public/300s, notes-strip  │
│   /report/[year]             — client-rendered scroll story            │
│   /manifest.webmanifest      — PWA manifest                            │
│   /sw.js                     — service worker (precache + planned      │
│                                periodicSync for notifications)         │
└────────────────────────────────────────────────────────────────────────┘
```

## Key decisions

- **Schema bumped to v6.** `SCHEMA_VERSION = 6` (`src/lib/migrate.ts`). v2 → v6 record migration is idempotent and runs from any prior version. `Subscription` and `Trial` gained optional `tags`, `priceChanges`, `usageLog`, `activeDiscount`, and `owners` fields across v4–v6. All optional with sane defaults so older blobs hydrate cleanly.
- **Sync prefixes BR1.–BR5. all readable; BR5E. is the encrypted variant.** `sync.ts` exposes prefix constants `PREFIX_V1`…`PREFIX_V5`. Writers emit the latest prefix; readers decode any prior version. `BR5E.` payloads wrap a `BR5.` payload inside an `ENC2.` AES-GCM envelope (PBKDF2-SHA256, 250k iter) and require a passphrase out-of-band.
- **No FX API.** Static rate table snapshotted on 2026-05-01 ships in `src/data/fx-rates.ts`. Users override per-currency in Settings → Currency.
- **Encryption boundary.** WebCrypto AES-GCM wraps localStorage values when the vault is enabled. Sync payloads remain cleartext by default; users opt in to encrypted share links (`BR5E.`). Decoy mode lives behind a second passphrase that routes to a parallel `burnrate.decoy.*` namespace, indistinguishable in the UI from real data.
- **IDB for time-series + scheduled notifications.** `snapshots` (monthly capture) stays in IDB. The notification-hub plan adds a second store `scheduled-notifications` (db version bump to 2) — schema designed, SW wiring deferred.
- **Multi-vault namespacing.** v6 plans every per-vault storage key as `burnrate.vault.<vaultId>.<slot>.<key>` with slot ∈ `real | decoy`. `vault-registry.ts` ships the migration plan and a normalize/add/remove/rename/setActive API; default vault id `default` is protected from deletion. Execution of the key-rewrite migration is deferred.
- **P2P sync is stateless.** WebRTC `RTCPeerConnection` over public STUN (`stun:stun.l.google.com:19302`) with manual paste-based signaling — no server-side state. QR encoder is a from-scratch Model-2 SVG renderer (v1–v10 binary mode); payloads >271 bytes fall back to copy-paste.
- **Live calendar feed is stateless.** `/s/[payload]/calendar.ics` is `force-dynamic`, decodes the URL payload, strips `notes` for privacy, and returns ICS with `Cache-Control: public, max-age=300, s-maxage=300`. Malformed payloads return 200 with a one-event ICS so calendar clients don't error out.
- **Annual report runs client-side.** `/report/[year]` is a client component that reads localStorage + IDB directly and uses `html2canvas` to export a PNG. No server data flow.
- **One big app component (still).** `BurnRateApp.tsx` orchestrates all state. The `useBurnRateState` extraction continues to be queued — see the carry-over note in `docs/progress/v4.md`.

## Testing strategy

- **Unit tests** for every `src/lib/*` module — currency, ledger, snapshots, recommendations, charges, charge-matcher, crypto, ICS, sync, budget, CSV, burnrate domain (v1–v3) plus bulk, tags, views, dashboard-layout, palette-query, history, categories, profile (v4), usage, price-changes, charge-calendar, discounts, annual-report, goals, cancellation-playbooks, cancellation-attempts (v5), and profiles, qrcode, peer-sync, crypto-share, decoy, notify, vault-registry (v6).
- **Route tests** in `src/app/__tests__/` cover the `/s/[payload]/calendar.ics` handler (valid payload → ICS body + cache headers; garbage payload → 200 with invalid-feed body; notes stripped).
- **Component tests** for `CommandPalette` (incl. operator filtering), `PopularServicesPicker`, and `BurnRateApp` (multiple files cover budget, sync, palette, popular, ICS, and original flows).
- **Playwright smoke** at `tests/e2e/` — runnable locally against `npm run dev`. Not wired into CI.
- `console.error` and `console.warn` cause a test failure — silent regressions get caught.
- Current total: **531 tests passing** as of the v6 lib pass.
