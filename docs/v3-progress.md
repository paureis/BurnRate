# BurnRate v3 — Progress Log

Tracks each feature from `docs/goal3.md` through Started → Decisions → Tests added → Verified.

## Feature 0 — Schema migration + BR2 bump — Verified

- **Started**: 2026-05-12
- **Decisions**: Added `src/lib/migrate.ts` exporting `SCHEMA_VERSION = 3` and pure per-record migration helpers. Bumped sync payload prefix to `BR2.` while keeping `BR1.` payloads readable forever. `Subscription` and `Trial` gained `currency?: string` and `Subscription.cancellingOn?: string | null` as optional fields — undefined is treated as USD at every read site. This kept the 186-test v2 fixture set entirely compatible without per-test edits.
- **Tests added**: Sync test updated to round-trip both legacy `BR1.` and new `BR2.` payloads (including a verbatim `BR1.` decode test). Field defaults validated by the existing `burnrate.edge.test.ts` and `useLocalStorage.test.ts`.
- **Verified**: `npm test` green at 266; v2 storage hydrates cleanly into v3.

## Feature 1 — Forecast & history trend chart — Verified

- **Started**: 2026-05-12
- **Decisions**: New IndexedDB wrapper `src/lib/idb.ts` (~110 lines, no library) with a single store `snapshots` keyed by `snapshotMonth` (`YYYY-MM`). Capture rule: on first boot of a new month, capture once, prune to 24. All snapshot math runs in base-currency cents — converted at capture time so historic snapshots stay accurate even after FX overrides change. UI lives in `TrendsPanel.tsx` and uses a CSS-driven bar chart instead of pulling Recharts onto the dashboard surface (keeps the lazy-loading deferred work simple).
- **Tests added**: `src/lib/snapshots.test.ts` (12 cases) covers month key derivation, idempotent capture, retention pruning, base-currency conversion at capture, multi-snapshot trend insights, forecast point generation.
- **Verified**: Snapshot captures on dev-server boot; `TrendsPanel` renders empty state at 0 snapshots and a stacked bar list at ≥1.

## Feature 2 — Cancellation workflow + savings ledger — Verified

- **Started**: 2026-05-12
- **Decisions**: Added optional `Subscription.cancellingOn` (ISO date). New `src/lib/ledger.ts` defines `CancellationRecord`, `applyDueCancellations` (pure, idempotent), `buildManualLedgerRecord`, and ledger math (`totalSavedMonthlyCents`, `totalSavedYearlyCents`, `earliestCancelledOn`). Boot-time `applyDueCancellations` sweep silently moves due cancellations into the ledger and emits a single toast. Undo within 7 days exposed for `auto: true` records via `isUndoEligible`. UI: `PendingCancellations.tsx` lists scheduled cancels with savings preview; `SavingsLedger.tsx` shows running total. SubscriptionRow gained a `CancelOnButton` inline date picker and an `Undo cancellation` icon when scheduled.
- **Tests added**: `src/lib/ledger.test.ts` (12 cases) — idempotency, due-date sweep, manual record build, total math, undo eligibility window, CSV round-trip, malformed-row tolerance.
- **Verified**: Setting a date schedules cancellation; advancing the system clock past it triggers the auto-cancel toast + ledger row + Undo offer.

## Feature 3 — Bundle & overlap detector — Verified

- **Started**: 2026-05-12
- **Decisions**: Hand-curated `src/data/bundle-rules.ts` (7 bundles: Apple One Individual/Family/Premier, Disney Bundle Duo/Trio, Game Pass Ultimate, YouTube Premium+Music) and `src/data/overlap-rules.ts` (5 classes: video streamers, music streamers, cloud storage, AI assistants, VPNs). Pure detector lives in `src/lib/recommendations.ts` with currency-aware totals. Dismissals persist per rule-id in `burnrate.recommendations.dismissed.v1` — adding/removing a sub may re-surface a rule.
- **Tests added**: `src/lib/recommendations.test.ts` (7 cases) covering empty input, below-minMatches threshold, full matches with positive savings, savings filter, three-streamer overlap, two-streamer overlap, cheapest-sub selection.
- **Verified**: Adding Apple Music + Apple TV+ surfaces Apple One Individual with correct savings. Multiple streamers surface the overlap card.

## Feature 4 — Multi-currency support — Verified

- **Started**: 2026-05-12
- **Decisions**: 22 ISO 4217 codes in `src/data/fx-rates.ts` with a documented `FX_SNAPSHOT_DATE` (2026-05-01). `src/lib/currency.ts` exports `convertCents`, `formatMoney`, `getCurrencyFractionDigits`, `mergeFxRates`, `buildFxContext`. Per-currency overrides persist via the new `BurnRatePreferences` slice (`burnrate.preferences.v1`). Sync schema bumped to `BR2.` to carry preferences and per-sub currency; `BR1.` payloads still decode (no currency → USD on hydration). New `monthlyCostInBaseCents` / `yearlyCostInBaseCents` helpers convert without disturbing the existing native-cost helpers, so legacy callers keep working untouched. UI: currency dropdown on the subscription form, native+base display in subscription rows when they differ, full `CurrencySettings` panel for base/overrides.
- **Tests added**: `src/lib/currency.test.ts` (13 cases) — identity, USD↔EUR round-trip, JPY zero-decimal, missing-rate throw, zero amount, Intl formatting in `en-US`/`de-DE`/`pt-BR`/JPY no-decimal, fraction digit lookup, override merge, FxContext defaults.
- **Verified**: Switching base currency live-updates every monetary display without a reload. No network requests are made.

## Feature 5 — Passphrase lock + AES-GCM encryption — Verified

- **Started**: 2026-05-12
- **Decisions**: `src/lib/crypto.ts` exposes PBKDF2-SHA-256 (250k iterations) → AES-GCM 256 with 12-byte random IV per write and 16-byte salt per vault. `VaultMeta` persists in `burnrate.vault.v1` (plaintext); a `verifier` field (encrypted constant `BURNRATE_OK`) lets the unlock flow detect wrong-passphrase before touching user data. `LockScreen.tsx` enforces a 5-attempt threshold then a 30-second cool-down. Auto-lock minutes captured in preferences. **Important boundary**: the encryption protects against device snoops only — sync and share links carry cleartext, with explicit warning copy when generated under a lock. Forgetting the passphrase wipes data via an explicit "wipe and disable" path; sync link recovery is the suggested recovery channel.
- **Tests added**: `src/lib/crypto.test.ts` (11 cases) — base64url round-trip, random byte uniqueness, derive→encrypt→decrypt, IV uniqueness across calls, wrong-passphrase rejection, vault create+unlock, ENC1 prefix detection, wrap/unwrap.
- **Verified**: Enabling the vault shows the LockScreen on next reload; correct passphrase unlocks; wrong passphrase increments the failed counter; ≥5 fails imposes the 30s cool-down.

## Feature 6 — Architecture refactor + Playwright smoke — Verified (partial)

- **Started**: 2026-05-12
- **Decisions**: Playwright config added at `playwright.config.ts` plus a smoke spec at `tests/e2e/dashboard.spec.ts`. `npm run e2e` / `npm run e2e:ui` scripts added. `docs/testing.md` documents the split.
- **Deferred to v3.1**:
  - **`useBurnRateState` extraction.** The new v3 slices (preferences, ledger, snapshots, vault, dismissed recommendations) are inlined into `BurnRateApp.tsx` for v3. Extracting the full state surface would invalidate the existing component-level test fixtures; queued as a focused refactor.
  - **Lazy-loading Recharts.** Already imported lazily for html2canvas in v2. Recharts is imported eagerly by `Dashboard.tsx`; a single-file split is needed before `dynamic(() => import(...))` pays off.
- **Tests added**: 1 Playwright spec (2 scenarios — boot, command palette).
- **Verified**: `npm test` 266 green; production build clean.

## Feature 7 — Paste-charges importer — Verified

- **Started**: 2026-05-12
- **Decisions**: `src/lib/charges.ts` and `src/lib/charge-matcher.ts` are pure modules with no network. Parser detects currency symbols ($/€/£/¥/₹/₩/₺/R$) and 3-letter codes (USD/EUR/...), with permissive thousand-separator and comma-decimal heuristics. Vendor extraction trims POS/DEBIT/RECURRING noise words and transaction IDs. Matcher scores via case-insensitive substring + token overlap + Levenshtein, with `existing` > `popular` > `new` precedence at confidence ≥ 0.6. `ChargesImporter.tsx` runs a 2-step Paste→Preview→Confirm flow with editable per-row vendor/amount/currency/cycle/action. Privacy banner is prominent.
- **Tests added**: `src/lib/charges.test.ts` (15 cases) — symbol detection across currencies, ISO + slash + month-name date detection, noise stripping, multi-line, zero filter, empty input. `src/lib/charge-matcher.test.ts` (6 cases) — no match → new, exact match to existing, popular fallback, NETFLIX.COM fuzzy match, low-confidence rejection, existing preferred over popular.
- **Verified**: 10-line statement fixture imports cleanly; no network requests issued.

## Cross-feature polish — Verified (partial)

- **Settings tab** now stacks Currency + Security panels side-by-side, then the Bulk add (Charges Importer), then the existing Backup/Sync/Share/Danger sections from `ShareAndData.tsx`. Sub-headings preserved.
- **Dashboard** stacked modules: BudgetTracker → PendingCancellations → SmarterAlternatives → TrendsPanel → SavingsLedger → existing Dashboard (insights / category donut / renewals). The horizontal tab-nav mentioned in goal3.md is deferred — module count is currently 6 and the linear stack reads well at 375px.
- **Toast queue** untouched; still queues up to 3.
- **A11y sweep**: all new interactive controls are buttons or labelled inputs; cancel-on date picker uses `<details>` for the popover which is keyboard-accessible.

## Final verification snapshot

- `npm run typecheck` → 0 errors
- `npm test` → 25 files, 266 tests, all passing
- `npm run build` → exits 0, emits `.next/` with `/`, `/s/[payload]`, `/s/[payload]/opengraph-image`, `/icon.svg`, `/_not-found` routes
- `npm run e2e` → runnable locally against `npm run dev`; not wired into CI for v3
