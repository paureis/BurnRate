# BurnRate v3 — Codex `/goal` Prompt

You are extending the **BurnRate** subscription tracker — a free, single-user, local-first web app already deployed on Vercel at `https://burnrate-bay.vercel.app`. The existing codebase is Next.js 16 + React 19 + TypeScript + Tailwind, with Recharts for visualizations, `localStorage` for persistence, a service-worker-cached PWA shell, a `#sync=` cross-device flow, a `/s/[payload]` read-only share route with dynamic OG images, a budget tracker, a popular-services picker, and a Cmd/Ctrl-K command palette.

This third milestone shifts BurnRate from *viewer of right now* to *coach across time*. It adds **seven features** themed around time, behavior change, and international quality-of-life. You must implement every feature, write tests for every feature, and meet every success criterion before stopping.

---

## Hard Constraints (do not violate)

- **Free hosting only.** Vercel Hobby tier or equivalent. No paid services. No paid APIs. No external secrets. No FX rate APIs (use bundled static rates).
- **Storage is the user's browser.** `localStorage`, `IndexedDB`, and `sessionStorage` are allowed. No database, no auth, no account creation, no telemetry that collects personal data.
- **No new runtime dependencies that aren't free and permissively licensed.** Prefer MIT / Apache-2.0 / ISC. Avoid heavy bundles — if a feature can be done in <300 lines without a library, do it inline.
- **Package security.** Use `socket npm install` for every new package. Never bare `npm install`. Use `npm ci` only from a lockfile. Honor the global `.npmrc` (`save-exact=true`, `ignore-scripts=true`, `audit=true`, `audit-level=high`).
- **No tracking, no fingerprinting, no third-party analytics scripts** beyond Vercel's built-in Web Analytics (already optional via env flag).
- **TypeScript strict.** No `any`. No `// @ts-ignore` unless paired with a one-line justification comment.
- **Accessibility regression-free.** Every new interactive element needs proper ARIA, keyboard support, focus-visible states, and works at 200% zoom.
- **Mobile-first.** Every new screen/component must look right at 375px width.
- **Backwards compatible storage.** Any change to `BurnRateData` shape must include a one-shot migration from the v2 layout. Reading a v2 `localStorage` blob must hydrate cleanly without data loss.
- **Sync links remain backward compatible.** `BR1.` payloads from v2 must still decode. Bump to `BR2.` only if the schema changes meaningfully (multi-currency does; design the upgrade path).
- **Run `npm run build`, `npm run typecheck`, and `npm test` after every feature.** Build must exit 0. Tests must pass. Zero TypeScript errors.

---

# Feature 1 — Forecast & History Trend Chart

**Goal:** Add the missing *time* axis. Users see how their burn has changed over the months they've been tracking and what their next 12 months look like if nothing changes.

## Implementation

### Monthly snapshot store

- Create `src/lib/snapshots.ts` and a new IndexedDB-backed store. The app does not currently use IndexedDB — write a small wrapper module `src/lib/idb.ts` (~80 lines, no library) exporting:
  ```ts
  export async function idbGetAll<T>(store: string): Promise<T[]>;
  export async function idbPut<T>(store: string, value: T): Promise<void>;
  export async function idbDelete(store: string, key: IDBValidKey): Promise<void>;
  ```
  Database: `burnrate`. Version: `1`. Object stores: `snapshots` (keyPath `snapshotMonth`).
- Snapshot shape:
  ```ts
  export interface MonthlySnapshot {
    snapshotMonth: string;           // "YYYY-MM" — primary key
    capturedAt: string;              // ISO timestamp of capture
    monthlyBurnCents: number;        // in base currency (see Feature 4)
    yearlyBurnCents: number;
    subscriptionCount: number;
    trialCount: number;
    categoryBreakdown: Record<string, number>;  // category → monthly cents
  }
  ```
- Capture rule: on app boot (after hydration), compare the latest snapshot's `snapshotMonth` to the current `YYYY-MM`. If different (or no snapshots exist), capture a new snapshot for the current month. Snapshots are immutable once captured for a month — only one per month, taken at first visit of that month.
- Retention: keep up to **24** snapshots. Prune oldest beyond that. Implement in `src/lib/snapshots.ts` as `captureSnapshotIfNeeded(data, now)` and `pruneSnapshots(snapshots, limit)`.
- CSV export/import must round-trip snapshots via a new `recordType=snapshot` row.

### Trends panel UI

- New component `src/components/TrendsPanel.tsx`, added to the **Dashboard** view below the existing modules (or as a dedicated **Trends** sub-tab if dashboard real estate gets cramped — judgment call).
- Two stacked Recharts visualizations:
  1. **History area chart** — x: month label, y: monthly burn cents. Tooltip shows category breakdown for that month. Empty-state copy: "We'll start drawing your trend after one full month of tracking — check back in [N] days."
  2. **12-month forecast line** — projects forward from today using current monthly burn, accounting for trials currently scheduled to convert and any subscriptions in "Cancelling on" state from Feature 2. Show as a dashed continuation of the history line in a different color.
- Three derived insights (added to the existing insights panel when ≥2 snapshots exist):
  - "Your burn grew/shrank by $X (Y%) over the last 3 months."
  - "Most expensive month tracked: [Month] at $X." (only fires if current ≠ max)
  - "If nothing changes, you'll spend $X over the next 12 months."

## Success Criteria
- [ ] `src/lib/idb.ts` and `src/lib/snapshots.ts` exist with unit tests in `src/lib/snapshots.test.ts` (using `fake-indexeddb` — add via `socket npm install fake-indexeddb@^6` to devDependencies only).
- [ ] Snapshot capture is idempotent within a month — calling `captureSnapshotIfNeeded` twice on the same day produces exactly one snapshot row.
- [ ] Retention prunes to 24 entries, oldest-first.
- [ ] Trends panel renders the empty state at 0 snapshots, a single-point chart at 1 snapshot, and a line at ≥2 snapshots.
- [ ] Forecast respects pending cancellations (Feature 2) and trial conversions (existing logic).
- [ ] CSV round-trip preserves snapshots (`recordType=snapshot` row covered by a unit test).
- [ ] Trends-driven insights only fire when ≥2 snapshots exist.
- [ ] Works at 375px — charts shrink, labels rotate, no horizontal overflow.

---

# Feature 2 — Cancellation Workflow & Savings Ledger

**Goal:** Turn "I should cancel this" into a one-click commitment that the app then carries through, and reward the user with a permanent tally of what they've actually saved.

## Implementation

### Pending cancellation status

- Add an optional field to `Subscription`:
  ```ts
  cancellingOn?: string | null;  // ISO YYYY-MM-DD; null/undefined = active
  ```
- New action on every subscription row: a small **"Cancel on date…"** button. Opens an inline date picker (no modal dependency). Default date: the existing `nextBillingDate` minus 1 day; user can pick any future date.
- Subscriptions with `cancellingOn` set render with:
  - A subdued "Cancelling [date]" pill (warm yellow / amber).
  - A strikethrough on the cost.
  - An **Undo cancellation** action.
- A new dashboard module **"Pending cancellations"** lists all such subs with the total projected monthly savings ("You'll save $X/mo starting [earliest date]").
- Burn calculations have a `projection` flag:
  - **Default ("current")** — includes pending cancellations in the totals (status quo).
  - **"After cancellations"** — excludes any sub with `cancellingOn ≤ targetDate`. Toggle on the dashboard.
- On app boot, run `applyDueCancellations(data, now)`: for each sub where `cancellingOn ≤ today`, move it to the savings ledger and remove it from the active list. This is **silent and automatic** — but the ledger entry includes `auto: true` and the dashboard surfaces a dismissible toast: "BurnRate auto-cancelled [Service] today as planned. You're saving $X/mo. Undo within 7 days."

### Savings ledger

- New module `src/lib/ledger.ts` and a new `CancellationRecord`:
  ```ts
  export interface CancellationRecord {
    id: string;                          // unique
    subscriptionName: string;
    category: string;
    monthlyCostCents: number;            // in base currency
    cancelledOn: string;                 // ISO YYYY-MM-DD
    recordedAt: string;                  // ISO timestamp
    auto: boolean;                       // true if auto-cancelled by due-date sweep
    note?: string;                       // optional user note ("trial we forgot to cancel")
  }
  ```
- Persist as `burnrate.ledger.v1` (`localStorage`). Append-only by design — entries can be deleted only from a "Manage ledger" sub-screen with a confirm.
- A new dashboard card **"Saved since [earliest cancelledOn]"** shows the running total of `monthlyCostCents × 12` across all ledger rows (rough but motivating). Tooltip clarifies "estimated annualized savings."
- A new insight: "You've cancelled N subscriptions worth $X/mo (≈ $Y/yr) since you started." Fires when ledger has ≥1 row.
- A manual "Add cancellation to ledger" action exists in the Subscriptions view so users can backfill cancellations they made before BurnRate existed.
- Undo: when a ledger row is ≤7 days old AND was created by auto-cancellation, an **Undo** action restores the subscription (with a fresh `nextBillingDate = today + 1 day` and the ledger row deleted).
- CSV round-trip via `recordType=ledger`.

## Success Criteria
- [ ] `Subscription.cancellingOn` is optional, defaults to `undefined`, and is preserved through CSV import/export.
- [ ] `applyDueCancellations` is pure, tested, and idempotent (running twice on the same `now` yields the same state).
- [ ] Auto-cancellation on app boot moves the sub to the ledger, emits a toast, and is undoable within 7 days.
- [ ] After 7 days, auto-cancel undo is no longer offered (UI hides the button).
- [ ] Projection toggle on the dashboard correctly recomputes monthly/yearly totals excluding pending cancellations.
- [ ] Ledger persists, survives reload, and round-trips through CSV with `recordType=ledger`.
- [ ] "Saved since" card and insight only appear when the ledger has ≥1 entry.
- [ ] Unit tests in `src/lib/ledger.test.ts` cover: add, delete, undo window, auto vs. manual entries, total-saved math, formatting.
- [ ] Integration test in `BurnRateApp.cancellation.test.tsx` covers the full flow: set cancelling-on → fast-forward `now` → boot → toast → undo restores the sub.

---

# Feature 3 — Bundle & Overlap Detector

**Goal:** Give users concrete dollar recommendations, not just data. Detect when their current subscription set can be replaced by a cheaper bundle, or when they're paying for redundant services.

## Implementation

- Create `src/data/bundle-rules.ts` exporting a typed rule pack:
  ```ts
  export interface BundleRule {
    id: string;                            // "apple-one-premier"
    label: string;                         // "Apple One Premier"
    replaces: string[];                    // service names (case-insensitive match against subscriptions)
    minMatches: number;                    // require at least N of `replaces` present (default = replaces.length - 1)
    bundleMonthlyCents: number;            // bundle's effective monthly cost (in USD; converted via Feature 4)
    bundleBillingCycle: BillingCycle;      // for display
    bundleNotes?: string;                  // "Family plan — split 5 ways"
    bundleCancelUrl?: string;
  }
  ```
- Ship at least these bundles, with current US prices documented in the file:
  - **Apple One Individual / Family / Premier** (replaces Apple Music, Apple TV+, iCloud+, Apple News+, Apple Arcade in various combinations).
  - **Google One + YouTube Premium** vs. separate (where applicable).
  - **Amazon Prime** covers Prime Video + Amazon Music basic + Kindle benefits.
  - **Disney Bundle** (Disney+, Hulu, ESPN+).
  - **Xbox Game Pass Ultimate** covers Game Pass + EA Play + Xbox Live Gold.
- Create `src/data/overlap-rules.ts`:
  ```ts
  export interface OverlapRule {
    id: string;
    label: string;                         // "Multiple video streamers"
    category: string;                      // "Entertainment"
    matchNames: string[];                  // exact-name matches considered "in this overlap class"
    minMatches: number;                    // default 2
    advice: string;                        // "Most households actively use only one or two."
  }
  ```
- Ship at least these overlap classes:
  - Video streamers: Netflix, Hulu, Max, Disney+, Apple TV+, Peacock, Paramount+, Prime Video, YouTube TV.
  - Music streamers: Spotify, Apple Music, YouTube Music, Tidal, Amazon Music Unlimited.
  - Cloud storage: Dropbox, Google One, iCloud+, OneDrive.
  - AI assistants: ChatGPT Plus, Claude Pro, Gemini Advanced, Perplexity Pro.
  - VPNs: NordVPN, ExpressVPN, Surfshark, Proton VPN.
- New pure module `src/lib/recommendations.ts`:
  ```ts
  export function detectBundles(subs: Subscription[], rules: BundleRule[]): BundleMatch[];
  export function detectOverlaps(subs: Subscription[], rules: OverlapRule[]): OverlapMatch[];
  ```
  Each match carries the matched subs, current monthly total in base currency, recommended monthly cost, and the dollar savings. Matches with `savingsCents ≤ 0` are filtered out.
- New dashboard module **"Smarter alternatives"** rendering matches as cards. Each card has:
  - Title (bundle name or overlap label).
  - Matched subs (chips with names).
  - Numbers: current $X/mo vs. recommended $Y/mo → save $Z/mo ($Z×12/yr).
  - Bundle cards: a "Set up [bundle]" CTA that links out to `bundleCancelUrl` (or, if absent, just dismisses).
  - Overlap cards: a "Cancel one" CTA that pre-selects the cheapest sub for the Feature 2 cancellation flow.
- Each card has a **Dismiss** action that hides it from this user (persist dismissed IDs in `burnrate.recommendations.dismissed.v1`). Dismissals are per-rule-id, not per-sub-set, so adding/removing a sub may re-surface a rule.

## Success Criteria
- [ ] `detectBundles` and `detectOverlaps` are pure and unit-tested in `src/lib/recommendations.test.ts`.
- [ ] Test cases include: no matches, partial matches (below `minMatches`), full match, bundle with savings, bundle with no savings (filtered), overlap with two subs, overlap with three subs (still one card).
- [ ] All shipped rules pass a sanity test: every name referenced exists in `popularServices` OR is documented as intentionally external.
- [ ] Smarter Alternatives section is hidden when no matches exist.
- [ ] Dismissed cards stay dismissed across reload.
- [ ] "Cancel one" CTA opens the Feature 2 inline cancellation date picker on the chosen sub.
- [ ] At least one bundle and one overlap appear in a fixture-driven UI test.
- [ ] Card layouts work at 375px (no horizontal overflow, no truncated dollar figures).

---

# Feature 4 — Multi-Currency Support

**Goal:** A user in São Paulo can track Netflix BRL, Spotify BRL, ChatGPT USD, Notion USD — and see their total in BRL (or USD, or EUR).

## Implementation

### Data model

- Add `currency` to `Subscription` and `Trial`:
  ```ts
  currency: string;  // ISO 4217 code, e.g. "USD", "BRL", "EUR", "GBP", "JPY". Default "USD" for v2 records during migration.
  ```
- Add a user preference for the **base currency** (default `"USD"`). Persist as `burnrate.preferences.v1`:
  ```ts
  export interface BurnRatePreferences {
    baseCurrency: string;
    fxOverrides: Record<string, number>;  // currency → units per 1 USD; overrides bundled table
    lastFxOverrideAt: string | null;       // ISO
  }
  ```
- Create `src/data/fx-rates.ts` with a frozen snapshot of FX rates as of a documented date (e.g., 2026-05-01), keyed `units per 1 USD`. Include at least: USD, EUR, GBP, JPY, CAD, AUD, BRL, MXN, INR, CHF, SEK, NOK, DKK, PLN, CZK, HUF, TRY, ZAR, KRW, SGD, HKD, NZD. Documented as static; users can override.
- New pure module `src/lib/currency.ts`:
  ```ts
  export function convertCents(amountCents: number, from: string, to: string, fx: FxTable): number;
  export function formatMoney(cents: number, currency: string, locale?: string): string;
  ```
  Uses `Intl.NumberFormat` for display. `convertCents` rounds to nearest cent.
- All monetary math in `src/lib/burnrate.ts`, `budget.ts`, `ledger.ts`, `snapshots.ts`, and `recommendations.ts` operates in **base currency cents** by converting on read. The stored sub's native amount is preserved exactly.

### UI

- Add a **currency dropdown** to the subscription add/edit form, defaulting to the user's base currency for new entries.
- Subscription list rows display **both**: native amount (e.g., `R$ 39,90/mo`) and, when different from base, a small base-currency equivalent (`≈ $7.85/mo`).
- New **Currency** section in the Settings tab:
  - Base currency dropdown.
  - "Bundled FX rates as of [date]" link/disclosure that lists the table.
  - Per-currency override inputs (only the ones currently used by user data, plus a "+ Add currency" affordance).
  - "Reset to bundled rates" button.
- Sync links: bump payload schema to `BR2.` to include currency and preferences. v3 must accept incoming `BR1.` payloads (assume `USD`, no overrides) and continue to **read** them indefinitely.
- Public share links: bump to `BR2.` similarly. The read-only share page formats values in the **author's** base currency at the time of share (i.e., the share payload includes the base currency and pre-converted totals for display; raw per-sub amounts may stay native for context).
- ICS export: event summaries use base currency for headline numbers but include the native amount in `DESCRIPTION` when different.
- Command palette: add "Change base currency" command.

## Success Criteria
- [ ] `convertCents` is unit-tested for: same currency (identity), USD→EUR, EUR→USD, rounding behavior, missing rate (throws), zero amount.
- [ ] `formatMoney` is unit-tested for: USD with `en-US`, EUR with `de-DE`, JPY (no decimals), BRL with `pt-BR`.
- [ ] V2 → V3 migration: a v2 `localStorage` blob with no `currency` field hydrates with every sub defaulted to `USD`. Tested in `src/hooks/useLocalStorage.migration.test.ts`.
- [ ] Sync: a v2 `BR1.` payload still decodes. A v3 `BR2.` payload round-trips with currencies preserved.
- [ ] Share: `/s/<BR2-payload>` renders with the author's base currency and converted totals.
- [ ] All existing burn / budget / ledger / recommendation tests are updated to operate in base-currency cents and still pass.
- [ ] Per-currency override edit persists across reload; "Reset" restores bundled rates.
- [ ] Switching base currency live-updates every monetary display without a reload.
- [ ] No external FX API is called. Network tab shows zero new requests.

---

# Feature 5 — Passphrase Lock & At-Rest Encryption

**Goal:** Optional protection for shared / family devices. With a passphrase set, BurnRate's local storage is encrypted with WebCrypto; opening the app requires unlocking.

## Implementation

### Crypto module

- New module `src/lib/crypto.ts`:
  ```ts
  export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey>;
  export async function encryptString(plaintext: string, key: CryptoKey): Promise<string>; // base64url(iv|ciphertext)
  export async function decryptString(ciphertext: string, key: CryptoKey): Promise<string>;
  ```
- Use WebCrypto **PBKDF2** (SHA-256, 250,000 iterations) for key derivation, **AES-GCM 256** for encryption, 12-byte random IV per write, 16-byte random salt stored once per vault.
- Vault metadata persisted as `burnrate.vault.v1` (always plaintext):
  ```ts
  interface VaultMeta {
    enabled: boolean;
    salt: string;        // base64url
    verifier: string;    // encrypted constant ("BURNRATE_OK")
    iterations: number;  // 250000
  }
  ```
  `verifier` lets the unlock flow detect a wrong passphrase without trying to decrypt user data.

### Encryption layer over storage

- Wrap `useLocalStorage` with a higher-order `useEncryptedLocalStorage` that:
  - Reads/writes via the existing API when the vault is **disabled**.
  - When **enabled and unlocked**, transparently encrypts values before write and decrypts on read.
  - When **enabled and locked**, returns `null` and refuses writes (caller must wait for unlock).
- Keep all existing localStorage keys (`burnrate.subscriptions.v1`, `burnrate.trials.v1`, etc.) but, when encrypted, prefix the stored value with `ENC1.` so the on-disk shape is unambiguous.

### UI

- New **Security** section in Settings:
  - "Enable passphrase lock" button → modal flow: enter passphrase twice + clear "There is **no** recovery. Forgetting this passphrase wipes your data on this device."
  - Once enabled: "Change passphrase" and "Disable lock" actions.
- Lock screen component `src/components/LockScreen.tsx`: full-page passphrase input on app boot when `vault.enabled === true` and no session unlock has happened this tab. After 5 failed attempts, add a 30-second cool-down between further attempts (client-side).
- Auto-lock: when the page is hidden for ≥ 15 minutes (`document.visibilitychange`), force a re-unlock. Configurable in Settings (5 / 15 / 60 / never).
- "Forgot passphrase" path: explicit "Wipe all data on this device" confirm. Sync links remain a recovery channel; the lock screen surfaces "If you have a sync link from another device, you can recover with that."

### Boundaries (be explicit in UI copy)

- Encryption protects against device snoops. Sync links and share links **still carry your data in cleartext** (because the receiving device can't otherwise read them). Warning copy must say so explicitly when generating either type of link while the vault is enabled.
- Command palette and other in-memory state are cleartext while the app is unlocked.

## Success Criteria
- [ ] `crypto.ts` is unit-tested in `src/lib/crypto.test.ts`: derive→encrypt→decrypt round-trip, wrong-passphrase decryption throws, IV uniqueness across consecutive encrypts (10-sample property test), base64url encoding is URL-safe.
- [ ] Enabling the vault encrypts existing data in place (one-shot migration), and disabling it decrypts back. Both flows are tested.
- [ ] Wrong passphrase on unlock shows a friendly error and increments the failed-attempt counter; after 5 failures, further attempts are rate-limited for 30s.
- [ ] After 15 minutes hidden, re-opening the tab requires re-unlock.
- [ ] When the vault is enabled, generating a sync or share link shows the "this link is cleartext" warning prominently.
- [ ] Disabling lock without knowing the passphrase requires the explicit "wipe and disable" action.
- [ ] Lock screen is keyboard-accessible, screen-reader friendly, and works at 375px.
- [ ] No new runtime dependency. WebCrypto only.

---

# Feature 6 — Architecture Refactor & E2E Smoke Suite

**Goal:** Pay down the v2 follow-up debt and establish a Playwright smoke test that exercises the app the way users do.

## Implementation

### `useBurnRateState` extraction

- Extract a `useBurnRateState` hook from `BurnRateApp.tsx` into `src/hooks/useBurnRateState.ts`. It owns:
  - All localStorage-backed slices (subs, trials, budget, ledger, preferences, vault).
  - Derived data (monthly burn, yearly burn, insights, recommendation matches).
  - Mutator callbacks (`addSubscription`, `updateSubscription`, `deleteSubscription`, `setCancellingOn`, `applyLedgerEntry`, etc.).
- Return a stable shape: `{ data, derived, actions }`. `actions` is memoized; components receive only what they need.
- `BurnRateApp.tsx` should drop below **500 lines** after this refactor. If it doesn't, split out one of: `DashboardView`, `SubscriptionsView`, `TrialsView`, `SettingsView` as thin orchestrator components.

### Lazy-load heavy modules

- `Recharts` and `html2canvas` are not on the critical path. Use `dynamic(() => import(...), { ssr: false })` to defer them.
- Measure home-route JS shipped before/after via `next build` output. Goal: home route **client JS** is ≤ 110KB gzipped post-refactor (current baseline measured during refactor; if already lower, hold the line).

### Playwright smoke suite

- `@playwright/test` is already a devDependency. Add `tests/e2e/` with at minimum:
  - `tests/e2e/dashboard.spec.ts` — boot → empty state → add via popular picker → totals update → reload → totals persist.
  - `tests/e2e/cancellation.spec.ts` — add a sub → set cancelling-on → trigger boot with system clock past the date → toast appears → undo works.
  - `tests/e2e/sync.spec.ts` — generate sync link → navigate to it in a fresh context → replace flow restores data.
  - `tests/e2e/lock.spec.ts` — enable passphrase → reload → lock screen appears → wrong then right passphrase → unlocked state.
- Add `npm run e2e` and `npm run e2e:ui` scripts. The e2e suite is **not** required in CI for this milestone but must be runnable locally against `npm run dev`.
- Add a brief `docs/testing.md` explaining how to run unit vs. e2e tests.

## Success Criteria
- [ ] `BurnRateApp.tsx` is under **500 lines** (excluding imports and blank lines).
- [ ] `useBurnRateState` hook exists with its own unit tests in `src/hooks/useBurnRateState.test.ts`.
- [ ] No component imports a slice it doesn't use.
- [ ] Home-route gzipped client JS is ≤ 110KB (record before/after in the commit message).
- [ ] All four Playwright specs pass against a local dev server.
- [ ] `docs/testing.md` exists and is accurate.
- [ ] No regression in the existing 190+ unit tests.

---

# Feature 7 — Paste-Charges Importer

**Goal:** Lower the cold-start cost of using BurnRate. Paste a block of text from your bank statement, email receipts, or credit-card export, and the app proposes which charges to add as subscriptions.

## Implementation

### Parser

- New module `src/lib/charges.ts`:
  ```ts
  export interface ParsedCharge {
    rawLine: string;
    amountCents: number;
    currency: string;             // detected ("USD" by default if symbol is "$" without disambiguation)
    vendorGuess: string;
    dateGuess?: string;           // ISO if a date was detected on the line
  }

  export function parseChargesText(text: string, defaults?: { currency?: string }): ParsedCharge[];
  ```
- Pure regex/string work — **no library**, no LLM, no network. Heuristics:
  - Split input into lines; ignore blank lines and lines without a parseable currency amount.
  - Detect amounts: `$12.99`, `€12,99`, `12.99 USD`, `R$ 12,99`, `£12.99`, `12,99 €`, `JPY 1200`, etc. Currency symbol or 3-letter code anywhere on the line.
  - Detect date: common formats (`2026-05-01`, `05/01/26`, `May 1`, `1 May 2026`). Optional.
  - Vendor guess: the longest run of letters on the line that is not the date, not the amount, and not a known noise word (`POS`, `DEBIT`, `RECURRING`, `TXN`, `*`, trailing transaction IDs). Trim transaction IDs of the form `*1234`, `#1234`, trailing digits longer than 4.
  - De-noise: collapse multi-spaces, strip leading/trailing punctuation.

### Matcher

- New module `src/lib/charge-matcher.ts`:
  ```ts
  export interface ChargeMatch {
    charge: ParsedCharge;
    matchType: 'existing' | 'popular' | 'new';
    matchedSubscriptionId?: string;     // when matchType === 'existing'
    matchedPopularName?: string;        // when matchType === 'popular'
    confidence: number;                 // 0..1
  }

  export function matchCharges(
    charges: ParsedCharge[],
    subscriptions: Subscription[],
    popularServices: PopularService[]
  ): ChargeMatch[];
  ```
- Scoring: case-insensitive substring + token-overlap + simple Levenshtein on the candidate names. Threshold confidence (e.g., ≥ 0.6) for `existing` / `popular`; below threshold falls back to `new` (manual confirm).
- Duplicate suppression: if a vendor appears multiple times in the input, collapse to the most recent (or highest amount, if no dates) as the canonical row, but expose count in the UI.

### UI

- New component `src/components/ChargesImporter.tsx`, surfaced in the Settings tab under a new **Bulk add** section.
- Flow:
  1. **Step 1 — Paste** — a large `<textarea>` with helper text: "Paste a block from your bank statement, credit card export, or a list of receipts. We parse client-side and never send your data anywhere."
  2. **Step 2 — Preview** — table of detected charges with columns: vendor (editable), amount (editable), currency (editable dropdown), proposed action (`Add as new` / `Match existing: [name]` / `Match popular: [name]` / `Ignore`).
  3. **Step 3 — Confirm** — show counts ("Adding 4 new, updating 1, ignoring 7") then commit. Each accepted "Add as new" becomes a `Subscription` with `billingCycle = 'monthly'` default (user can adjust per-row before confirm) and `nextBillingDate = first of next month`.
- Errors: empty input shows a friendly message. A line that parses to amount=0 is filtered with a one-line "Ignored 2 unparseable lines" note.
- Privacy banner above step 1: "Parsing happens entirely in your browser. Nothing leaves this device."
- Command palette: add "Bulk add from pasted charges" command.

## Success Criteria
- [ ] `parseChargesText` is unit-tested in `src/lib/charges.test.ts` with ≥ 20 cases including: each currency format above, dated and undated lines, noise removal, multi-line input, completely-blank input.
- [ ] `matchCharges` is unit-tested in `src/lib/charge-matcher.test.ts` covering: exact match to existing, fuzzy match to existing (`Netflix.com` → `Netflix`), exact match to popular, no-match falls back to `new`, duplicate-vendor collapsing.
- [ ] Integration test `ChargesImporter.test.tsx` covers: paste → preview shows expected rows → edit a row → confirm adds the right subscriptions and emits the right toast.
- [ ] No network requests are made during parsing or matching.
- [ ] Privacy banner is present on step 1.
- [ ] Importer is keyboard-accessible, screen-reader friendly, and the preview table works at 375px (collapses to stacked cards).
- [ ] Importer respects the user's base currency for `Add as new` rows whose detected currency matches base; mismatched currencies are preserved as native (Feature 4).

---

# Cross-Feature Polish (also required)

- **Settings tab grows.** Add sections in this order: *Currency* (Feature 4), *Goals* (existing v2), *Security* (Feature 5), *Backup* (CSV, ICS, .burn), *Bulk add* (Feature 7), *Sync*, *Share*, *Danger zone*. Keep each section collapsible if total height exceeds ~1500px.
- **New dashboard sub-tabs.** When the dashboard module count exceeds ~6, introduce a horizontal pill-tab nav with: *Overview*, *Trends* (Feature 1), *Smarter alternatives* (Feature 3), *Pending cancellations* (Feature 2). Mobile collapses to a select.
- **Migration.** A single `migrateBurnRateData(stored: unknown): BurnRateData` function in `src/lib/migrate.ts` handles the v2 → v3 schema bump. Tested with real v2 fixtures.
- **Schema version constant.** Bump `SCHEMA_VERSION` to `3` in a central place.
- **Toast queue stays.** No regressions to the v2 toast queue.
- **A11y sweep.** Run an axe check on every new screen and fix violations.

## Cross-Feature Success Criteria
- [ ] V2 storage hydrates cleanly into v3 — verified by a fixture test that loads each v2 storage key and asserts the resulting `BurnRateData` shape.
- [ ] Settings tab sections render in the documented order.
- [ ] Dashboard tab-nav appears at the documented module count and is keyboard-navigable.
- [ ] `npm run typecheck` and `npm test` stay green throughout.
- [ ] No console warnings on first load.

---

# Required Documentation Updates

- Update `README.md`:
  - Add v3 features to the feature list.
  - Document multi-currency, passphrase lock, and the cancellation/ledger flow.
  - Update privacy section: "When the vault is enabled, your localStorage is encrypted with WebCrypto AES-GCM. Sync and share links remain cleartext — see Settings for the warnings."
- Update `docs/architecture.md` to a "v3" version reflecting:
  - The new IndexedDB store (`snapshots`).
  - The encryption layer wrapping `localStorage`.
  - The new pure libs (`snapshots.ts`, `idb.ts`, `currency.ts`, `crypto.ts`, `ledger.ts`, `recommendations.ts`, `charges.ts`, `charge-matcher.ts`).
  - The schema-version bump and migration entry point.
- Create `docs/v3-progress.md` and maintain it as you go (one section per feature, with Started / Decisions / Tests added / Verified).
- Create `docs/testing.md` (from Feature 6).
- Mark `docs/goal2.md` historical (already done) and reference `docs/goal3.md` as the active goal.

---

# Final Verification Checklist

Before declaring the milestone complete, run every step below and confirm green. **Do not stop until every box can be checked.**

1. [ ] `npm run typecheck` → 0 errors.
2. [ ] `npm test` → all unit tests pass (target: ≥ 260 tests after v3).
3. [ ] `npm run build` → exits 0, produces a working `.next/` output.
4. [ ] `npm run dev` and manually walk through:
   - [ ] Fresh browser → empty dashboard → import from pasted charges (use a fixture of 10 lines) → 4 subs added with right currency.
   - [ ] Switch base currency from USD to EUR → every total recomputes, native amounts unchanged.
   - [ ] Add Apple Music + Apple TV+ + iCloud+ → "Apple One" recommendation appears with correct savings.
   - [ ] Add Netflix + Hulu + Max → "Multiple video streamers" overlap appears.
   - [ ] Set a sub to cancel on tomorrow → fast-forward (e.g., via DevTools time override or by editing the date to yesterday) → reload → auto-cancel toast appears, ledger has a row, Undo restores it.
   - [ ] Enable passphrase lock → reload → lock screen appears → wrong passphrase shows error → right passphrase unlocks.
   - [ ] With vault enabled, generate a sync link → confirm the cleartext warning is visible.
   - [ ] Visit a `BR1.` payload (from v2) → still decodes.
   - [ ] Visit a `BR2.` payload (from v3) → decodes; currencies preserved.
   - [ ] Trends panel: empty after first visit; after editing the captured snapshot or seeding a fixture snapshot, shows a chart.
   - [ ] PWA install still works; offline still serves the cached shell.
   - [ ] 375px viewport — every new screen and modal is usable.
   - [ ] Light mode and dark mode both look correct on every new surface.
5. [ ] Lighthouse on `localhost:3000`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, PWA ≥ 90.
6. [ ] Home-route gzipped client JS ≤ 110KB (recorded in commit message).
7. [ ] Vercel preview deploy succeeds; the deployed URL works end-to-end.
8. [ ] No new third-party scripts loaded at runtime.
9. [ ] `socket scan` (if a token is available) reports 0 high-severity issues. Otherwise note "no token, skipped — manual review done."
10. [ ] Every feature's individual success-criteria list above is fully checked.

---

# Stopping Condition

**Stop only when every check above is green and the progress log shows every feature `Verified`.** If you hit an obstacle, document it in `docs/v3-progress.md`, attempt a workaround, and only escalate to a human if the workaround would violate a hard constraint above.
