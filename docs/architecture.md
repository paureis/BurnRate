# BurnRate v2 — Architecture (1-page)

BurnRate is a single-user Next.js 16 (App Router) app that stores everything in the user's browser. There is no server-side state — every "feature" is just a pure module operating on a `BurnRateData` value.

## Runtime data flow

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser tab                             │
│                                                                  │
│   localStorage                                                   │
│   ├─ burnrate.subscriptions.v1                                   │
│   ├─ burnrate.trials.v1                                          │
│   ├─ burnrate.budget.v1                                          │
│   ├─ burnrate.theme.v1                                           │
│   └─ burnrate.trialAlertsDismissed.v1                            │
│           │                                                      │
│           ▼ useLocalStorage hook                                 │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │  BurnRateApp.tsx  (one big stateful client component)   │    │
│   │   ├─ Dashboard ─ HeroMetrics, CategoryDonut, Insights   │    │
│   │   ├─ SubscriptionManager (CRUD)                         │    │
│   │   ├─ TrialTracker (CRUD + countdowns)                   │    │
│   │   ├─ Simulator                                          │    │
│   │   ├─ ShareAndData ("Settings & Data" tab)               │    │
│   │   ├─ BudgetTracker                                      │    │
│   │   ├─ PopularServicesPicker                              │    │
│   │   ├─ CommandPalette (Cmd/Ctrl-K)                        │    │
│   │   ├─ SyncModal (#sync= hash handler)                    │    │
│   │   └─ ServiceWorkerRegistrar                             │    │
│   └─────────────────────────────────────────────────────────┘    │
│           │                                                      │
│           ▼ pure logic (src/lib/*)                               │
│   ┌─────────────────────────────────────────────────────────┐    │
│   │  burnrate.ts   — money math, CSV, insights, metrics     │    │
│   │  ics.ts        — RFC 5545 calendar serializer           │    │
│   │  sync.ts       — lz-string + checksum payloads          │    │
│   │  budget.ts     — cap/savings progress                   │    │
│   │  dataActions.ts— file download + clipboard helpers      │    │
│   └─────────────────────────────────────────────────────────┘    │
│           │                                                      │
│           ▼ generated at request time                            │
│   /s/[payload]/page.tsx          — read-only public share        │
│   /s/[payload]/opengraph-image   — dynamic OG (next/og)          │
│   /manifest.webmanifest          — PWA manifest                  │
│   /sw.js                         — service worker (precache)     │
└──────────────────────────────────────────────────────────────────┘
```

## Key decisions

- **No static export.** Migrated off `output: "export"` so the public share route can run server-side and generate dynamic OG images via `next/og`.
- **Pure libs.** Every domain function is pure and unit-tested independently. UI tests cover wiring.
- **Free hosting only.** Vercel Hobby works because compute use is small and on-demand.
- **No DB / auth.** Sync between devices uses a URL fragment (privacy-friendly — fragments aren't sent to the server) compressed with `lz-string`. Tamper detection via a 32-bit FNV-1a checksum.
- **Notes are sensitive.** Public share links strip the `notes` field before encoding; the OG image never reads it.
- **One big app component.** `BurnRateApp.tsx` orchestrates all state; child components are mostly dumb. When state grows, consider extracting `useBurnRateState` and `useBurnRateExports` (see `src/lib/dataActions.ts` for the export helpers already extracted).

## Testing strategy

- **Unit tests** for every `src/lib/*` module (ICS, sync, budget, CSV, burnrate domain).
- **Component tests** for `CommandPalette`, `PopularServicesPicker`, and `BurnRateApp` (multiple files cover budget, sync, palette, popular, ICS, and original flows).
- **Manifest tests** verify PWA shape and that referenced icons exist on disk.
- `console.error` and `console.warn` cause a test failure — silent regressions get caught.
