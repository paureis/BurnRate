# BurnRate v5 — Codex `/goal` Prompt

You are extending the **BurnRate** subscription tracker — a free, single-user, local-first web app already deployed on Vercel at `https://burnrate-bay.vercel.app`. As of v4 the app supports: per-record currency, passphrase lock with AES-GCM encryption, cancellation workflow + savings ledger, monthly trend snapshots, bundle/overlap detection, paste-charges importer, multi-select bulk operations, tags + saved views, customizable dashboard layout, structured search operators in the command palette, a 20-entry audit log with undo, custom categories, and `.burnprofile` settings export. Sync prefix is `BR3.` (with `BR1.` and `BR2.` still readable).

This fifth milestone shifts BurnRate from *capable assistant* to *active coach*. It adds **seven features** themed around behavior change: tracking actual usage, anticipating future price hikes, surfacing temporal spending patterns, logging retention discounts, generating annual reports, expanding the goal engine, and walking users through cancellation. You must implement every feature, write tests for every feature, and meet every success criterion before stopping.

---

## Hard Constraints (do not violate)

- **Free hosting only.** Vercel Hobby tier or equivalent. No paid services. No paid APIs. No external secrets. No FX rate APIs.
- **Storage is the user's browser.** `localStorage`, `IndexedDB`, and `sessionStorage` are allowed. No database, no auth, no account creation, no telemetry that collects personal data.
- **No new runtime dependencies that aren't free and permissively licensed.** Prefer MIT / Apache-2.0 / ISC. Avoid heavy bundles. PDF generation, if needed for the annual report, MUST use `html2canvas` (already a v2 dependency) → in-browser `window.print()` → PDF, **not** a new library like `jspdf`.
- **No LLM, no AI inference, no model weights shipped to the browser.** Every recommendation in this milestone is deterministic and tested.
- **Package security.** Use `socket npm install` for every new package. Never bare `npm install`. Use `npm ci` only from a lockfile.
- **No tracking, no fingerprinting, no third-party analytics scripts** beyond Vercel's built-in Web Analytics.
- **TypeScript strict.** No `any`. No `// @ts-ignore` unless paired with a one-line justification comment.
- **Accessibility regression-free.** Every new interactive element needs proper ARIA, keyboard support, focus-visible states, and works at 200% zoom. Animated story content (Feature 5) MUST respect `prefers-reduced-motion`.
- **Mobile-first.** Every new screen/component must look right at 375px width.
- **Backwards compatible storage.** Any change to `Subscription` or related shapes must include a one-shot migration from the v4 layout. Reading a v4 `localStorage` blob must hydrate cleanly without data loss.
- **Sync links remain backward compatible.** `BR1.`, `BR2.`, and `BR3.` payloads must still decode. Bump to `BR4.` for the v5-only fields (usage log, planned price changes, active discounts, expanded goals, cancellation attempts).
- **Run `npm run build`, `npm run typecheck`, and `npm test` after every feature.** Build must exit 0. Tests must pass. Zero TypeScript errors.

---

# Feature 1 — Usage Tracker & ROI Scoring

**Goal:** A subscription's true cost isn't its price — it's its cost per use. Users log whether they used each sub this month; BurnRate scores each one with cost-per-use, lifetime spend, and ROI badges that drive coaching insights.

## Implementation

### Data model

- Add an optional field to `Subscription`:
  ```ts
  usageLog?: Record<string, UsageEntry>;   // keyed by "YYYY-MM"
  ```
  with
  ```ts
  export interface UsageEntry {
    used: boolean;                          // explicit yes/no
    sessionCount?: number;                  // optional fine-grain
    note?: string;
    recordedAt: string;                     // ISO
  }
  ```
- Add an optional field for derived score caching in `BurnRatePreferences`:
  ```ts
  usageNudge?: {
    lastNudgeMonth?: string;                // "YYYY-MM"
    suppressed?: string[];                  // subscription ids the user dismissed
  };
  ```

### Score module

- New pure module `src/lib/usage.ts`:
  ```ts
  export interface RoiScore {
    subscriptionId: string;
    monthsTracked: number;
    monthsUsed: number;
    monthsZeroUse: number;                  // contiguous run ending most-recent month
    lifetimeSpendCents: number;             // base currency
    costPerUseCents: number | null;         // null when monthsUsed === 0
    badge: 'hero' | 'steady' | 'mixed' | 'zombie' | 'ghost' | 'untracked';
  }

  export function scoreUsage(sub: Subscription, fx: FxContext, now: Date): RoiScore;
  export function recordUsage(sub: Subscription, month: string, entry: UsageEntry): Subscription;
  export function shouldNudgeForMonth(prefs: BurnRatePreferences, now: Date): boolean;
  ```
- Badge rules (deterministic):
  - **hero** — `monthsUsed >= 3` AND `costPerUseCents <= 100` (under $1/use), regardless of months tracked.
  - **steady** — `monthsUsed / monthsTracked >= 0.66` and not a hero.
  - **mixed** — `monthsUsed / monthsTracked` between `0.33` and `0.66`.
  - **zombie** — `monthsUsed >= 1` but `monthsZeroUse >= 3` (you used to use it; you don't anymore).
  - **ghost** — `monthsUsed === 0` and `monthsTracked >= 2`.
  - **untracked** — fewer than 2 months of data.

### Nudge flow

- On the first app boot of a new calendar month (post-v3 snapshot capture, before any dashboard render), if `shouldNudgeForMonth` returns true, surface a dismissible **Usage check-in** banner: "How did you use your subscriptions last month?"
- Clicking the banner opens `UsageCheckIn.tsx` — a scrollable list of every active subscription with three buttons per row: ✅ *Used*, ❌ *Didn't use*, ⏭ *Skip for now*. The "Skip for all" footer dismisses without recording.
- Recording an entry writes to `sub.usageLog[lastMonth]` immutably.
- The banner does not auto-reopen within the same month — only the next month's first boot.

### Display

- Each subscription row in the Subscriptions view shows the ROI badge as a small chip with a tooltip ("Cost per use: $1.23 over 8 months").
- New dashboard module `UsageInsights.tsx` (id: `usage`, slot the v4 dashboard layout reserved). Shows:
  - Top 3 ghosts ("Last used: never tracked; spent $X to date").
  - Top 3 zombies ("Used to be a regular; nothing in 3+ months").
  - Top 3 heroes ("Cheapest per use this year").
- "Cancel coach" CTA on every ghost / zombie card pipes into Feature 7.

## Success Criteria
- [ ] `scoreUsage` is unit-tested in `src/lib/usage.test.ts` (≥ 15 cases) covering: each badge rule, missing log entirely, single-month log, mixed-month log, the contiguous zero-use definition.
- [ ] `recordUsage` is immutable — it returns a new `Subscription` and never mutates the input.
- [ ] `shouldNudgeForMonth` returns false within the same month as `lastNudgeMonth`; true otherwise.
- [ ] Check-in banner appears on first boot of a new calendar month and is dismissible.
- [ ] Recording every sub for last month dismisses the banner; partial recording also dismisses for that month (user opted in once).
- [ ] Usage round-trips through CSV (`recordType=usage`) and `BR4.` sync.
- [ ] ROI badge chips on rows reflect the score within one render after a usage entry is recorded (no reload required).
- [ ] `UsageInsights` is hidden until at least 2 months of usage data exist for at least one sub.
- [ ] Component test `UsageCheckIn.test.tsx` covers: render list, ✅/❌/⏭ flow, "skip all" path, persistence.

---

# Feature 2 — Price-Change Scheduler

**Goal:** Streaming services announce price hikes months in advance. Users queue the future price per sub; BurnRate honors it in the trend forecast and applies it automatically on the effective date, with a toast.

## Implementation

### Data model

- Add an optional field to `Subscription`:
  ```ts
  priceChanges?: Array<{
    id: string;                              // ulid-ish
    effectiveDate: string;                   // ISO YYYY-MM-DD
    newCostCents: number;                    // in the sub's native currency
    note?: string;                           // "Standard tier going to $17.99 per Netflix announcement"
    addedAt: string;                         // ISO
  }>;
  ```

### Pure helpers

- New module `src/lib/price-changes.ts`:
  ```ts
  export function applyDuePriceChanges(
    subs: Subscription[],
    now: Date,
  ): { next: Subscription[]; applied: Array<{ subscriptionId: string; oldCents: number; newCents: number; effectiveDate: string }> };

  export function projectMonthlyBurnWithChanges(
    sub: Subscription,
    monthOffset: number,                     // 0 = current month
    fx: FxContext,
    now: Date,
  ): number;                                 // cents in base currency for that month

  export function expandPriceChangeTimeline(
    subs: Subscription[],
    horizonMonths: number,
    fx: FxContext,
    now: Date,
  ): Array<{ month: string; baseCents: number; eventsAtThisMonth: string[] }>;
  ```
- On app boot, after the v3 cancellation sweep, run `applyDuePriceChanges`. Each applied change emits one toast: "Netflix cost increased to $17.99 today as scheduled." Multiple changes coalesce into a single "3 subscriptions had scheduled price changes apply today" toast with a details disclosure.
- Each application records exactly one audit-log entry per sub (v4 Feature 5).

### UI

- The subscription edit form gains a **Planned price changes** section: list of upcoming changes with edit + delete actions, plus an "Add change" form (date + new cost + optional note). Past-dated changes are hidden (they've already applied).
- Subscriptions with at least one upcoming change show a small calendar-arrow chip on their row in the Subscriptions view: "↗ +$2 on Aug 1".
- The v3 Trends panel's forecast curve must use `projectMonthlyBurnWithChanges` — the dashed forecast line bends correctly when changes are queued.
- Command palette: "Add price change to <sub name>" command exists per subscription.

## Success Criteria
- [ ] `applyDuePriceChanges` is pure and unit-tested in `src/lib/price-changes.test.ts`: idempotent on the same `now`, applies multiple due changes ordered by date, leaves future changes untouched, deletes the applied entry from the sub's `priceChanges`.
- [ ] `projectMonthlyBurnWithChanges` matches the current monthly cost when no changes exist; reflects the change at month N when scheduled effective in month N-k.
- [ ] `expandPriceChangeTimeline` produces a `horizonMonths`-long array where each `eventsAtThisMonth` is non-empty exactly on months with a scheduled change.
- [ ] Adding a price change persists across reload and round-trips through CSV (`recordType=priceChange`) and `BR4.` sync.
- [ ] The Trends forecast line visibly bends at the scheduled month (verified by reading the rendered SVG path attributes in a Vitest snapshot or DOM test).
- [ ] Past-dated changes never appear in the edit form (filtered out as "applied" or pruned).
- [ ] Boot-time application of due changes records audit-log entries with op `updateSubscription` and a clear summary.
- [ ] Component test `PriceChangeEditor.test.tsx` covers: add, edit, delete, validation (effective date ≥ today, new cost > 0).

---

# Feature 3 — Charge Calendar Heatmap

**Goal:** Show the actual *days* money leaves the user's accounts. A GitHub-contributions-style grid surfaces clustering (everyone-bills-on-the-1st), gaps, and the user's heaviest months.

## Implementation

### Derivation

- New pure module `src/lib/charge-calendar.ts`:
  ```ts
  export interface ChargeDay {
    date: string;                            // ISO YYYY-MM-DD
    totalCents: number;                      // base currency
    chargeCount: number;
    contributors: Array<{ subscriptionId: string; amountCents: number; cycle: BillingCycle }>;
  }

  export function buildChargeCalendar(
    subs: Subscription[],
    horizonDays: number,                     // looking back from today
    fx: FxContext,
    now: Date,
  ): ChargeDay[];

  export function summarizeChargeCalendar(days: ChargeDay[]): {
    totalCents: number;
    peakDay: ChargeDay | null;
    avgCentsPerActiveDay: number;
    activeDayCount: number;
    dominantDayOfMonth: number | null;       // most common day-of-month (1–31) when ≥40% of charges fall there
    dominantDayOfWeek: number | null;        // 0=Sun…6=Sat
  };
  ```
- Charges are derived from `nextBillingDate` walked **backward** by the billing cycle. Stop at `horizonDays` ago. For weekly cycles, walk in weeks; for monthly, walk by month with end-of-month wrap (Jan 31 → Feb 28); for quarterly, walk 3 months; for yearly, walk 12 months.
- Convert each charge to base currency at FX-context time.
- Pre-v3-cancellation history: if a sub has a `cancelledOn` entry in the ledger, its charges before `cancelledOn` are still surfaced; charges after are not.

### UI

- New component `ChargeCalendar.tsx`:
  - Renders 53 weeks × 7 days as a grid of square cells. Each cell's background is a 5-step intensity scale from the dominant theme color, computed from the day's `totalCents` quantile.
  - Hover/focus on a cell pops a tooltip listing each contributing sub and amount.
  - A trailing "Summary" panel surfaces the `dominantDayOfMonth`, `dominantDayOfWeek` (named), peak day, and 30-day rolling average.
- Module is reachable from the dashboard layout (new `dashboardModuleId: 'calendar'`) and from a "Charge calendar" command-palette entry.
- 375px: collapse the grid to 13 weeks × 7 days with a horizontal scroll for the full 53-week view; controls labeled "Last 90 days / Last 12 months."

## Success Criteria
- [ ] `buildChargeCalendar` is unit-tested in `src/lib/charge-calendar.test.ts`: empty subs, single monthly sub over 12 months, mixed cycles, end-of-month wrap correctness (Jan 31 → Feb 28 → Mar 31), currency conversion.
- [ ] `summarizeChargeCalendar` is unit-tested: dominant-day-of-month threshold (only reports if ≥40%), null when no charges, peak-day selection on a tie (latest wins).
- [ ] Calendar uses `prefers-color-scheme` and the active theme — both light and dark modes render legibly.
- [ ] Tooltip is keyboard-accessible (cells are focusable; Enter/Space toggles the tooltip).
- [ ] 53-week grid does not horizontally overflow at 375px when collapsed to 13 weeks (only the explicit scroll mode allows overflow).
- [ ] Component test `ChargeCalendar.test.tsx` covers: empty state ("Track for a month to see your charge pattern"), populated state, tooltip open on focus.
- [ ] Module appears in the v4 dashboard layout editor (added to `DASHBOARD_MODULES`) and respects show/hide and order.

---

# Feature 4 — Retention & Discount Log

**Goal:** Most subscriptions have a retention path (cancellation-flow discounts, student pricing, annual prepay deals). Users track what they negotiated, when it expires, and how much they're saving versus the current public price.

## Implementation

### Data model

- Add an optional field to `Subscription`:
  ```ts
  activeDiscount?: {
    id: string;
    originalCostCents: number;               // native currency — the price before this discount
    negotiatedOn: string;                    // ISO YYYY-MM-DD
    expiresOn?: string;                      // ISO; absent = open-ended
    note?: string;                           // "Threatened to cancel, kept Premium at Standard price"
    source: 'retention' | 'promo' | 'student' | 'annual-prepay' | 'household' | 'other';
  };
  ```
- The sub's `costCents` field carries the **discounted** monthly cost (the price the user actually pays). `activeDiscount.originalCostCents` is the strike-through reference.

### Helpers

- New module `src/lib/discounts.ts`:
  ```ts
  export function publicPriceLookup(serviceName: string): { cents: number; source: 'popularServices' | 'none' };
  export function summarizeDiscount(sub: Subscription, fx: FxContext, now: Date): DiscountSummary;
  export function isExpiringSoon(sub: Subscription, now: Date, windowDays?: number): boolean;
  export function totalActiveDiscountsCents(subs: Subscription[], fx: FxContext, now: Date): { monthly: number; yearly: number };
  ```
  with
  ```ts
  export interface DiscountSummary {
    subscriptionId: string;
    monthlySavingsCents: number;             // base currency
    annualSavingsCents: number;
    daysUntilExpiry: number | null;
    publicPriceComparisonCents: number | null;
    publicPriceDeltaCents: number | null;
  }
  ```
- Public price lookup hits `popularServices` from v2 by case-insensitive name match, returning `defaultCents`. Missing matches return `none`.

### UI

- Subscription edit form gains a **Discount** section: toggle "I'm on a discount" → reveals `originalCostCents` + `source` + `negotiatedOn` + `expiresOn?` + `note?`. The current `costCents` field is repurposed as "you pay" with a small "(was $X.XX)" caption.
- Subscriptions with an active discount render a discount-badge chip on the row.
- New dashboard module `RetentionLog.tsx` (id: `retention`, added to `DASHBOARD_MODULES`). Shows:
  - Total active monthly + annual savings (header).
  - Card per discount: service name, savings, expiry countdown, source label.
  - "Expiring within 14 days" subsection that's loud (amber border) and persistent until the user dismisses or edits.
  - "Compare to current public price" line per card when `publicPriceDeltaCents` is non-null: "Public price is now $22.99 — your locked rate saves $5/mo."
- On expiry-day boot, a toast nudges the user: "Your Netflix discount expired today. Compare to current price." with an action that opens the row.

## Success Criteria
- [ ] `summarizeDiscount` is unit-tested in `src/lib/discounts.test.ts` covering: no discount → throws or returns null, monthly savings math, currency conversion, expired discount (negative `daysUntilExpiry`), public-price lookup hit and miss.
- [ ] `isExpiringSoon` returns true within the 14-day default window and false outside.
- [ ] `totalActiveDiscountsCents` sums across active discounts only (expired excluded).
- [ ] Discount round-trips through CSV (`recordType=discount` row referencing the sub id) and `BR4.` sync.
- [ ] Discount badge on a row shows the strike-through original price visibly.
- [ ] Expiry-day toast appears exactly once on the day of (boot-time idempotency via the `usageNudge`-style "lastSeen" pattern; reuse the same mechanism).
- [ ] Component test `RetentionLog.test.tsx`: empty state, populated state, expiring-soon emphasis, public-price comparison shown when popular sub.
- [ ] Discount removal is a single audit-log entry; editing original cost is a single entry.

---

# Feature 5 — End-of-Year Report

**Goal:** Once a year, BurnRate produces a beautiful, scroll-driven recap of how the user used the app. Designed to be screenshotted and shared.

## Implementation

### Data assembly

- New module `src/lib/annual-report.ts`:
  ```ts
  export interface AnnualReport {
    year: number;
    baseCurrency: string;
    totalSpendCents: number;
    topSubscriptions: Array<{ name: string; cents: number; category: string }>;          // top 5 by total annual cents
    biggestMonth: { month: string; cents: number };
    quietestMonth: { month: string; cents: number };
    cancellationsCount: number;
    cancellationsSavedAnnualCents: number;
    biggestWin: { name: string; annualSavedCents: number } | null;
    roiHeroes: string[];                                                                 // top 3 hero subs by cost-per-use
    roiZombies: string[];                                                                // top 3 zombies by lifetime spend
    categoryBreakdown: Array<{ category: string; cents: number; pct: number }>;
    newSubsAdded: number;
    avgMonthlyBurnCents: number;
    streaks: { longestNoNewSubsDays: number };
    lifetime: { firstSnapshotMonth: string | null; totalCentsAcrossAllSnapshots: number };
  }

  export function buildAnnualReport(year: number, state: AppState, fx: FxContext): AnnualReport;
  export function isReportReady(year: number, state: AppState, now: Date): boolean;
  ```
- A report is "ready" when at least 6 months of `snapshots` (v3) exist within the target year. Otherwise the UI shows a partial-data caveat.

### Route + UI

- New route `src/app/report/[year]/page.tsx`. The page reads `localStorage` directly (the route is a client component) — no server data flow. URL is private to the user's device.
- Scroll-driven sections (full-width, snap-scroll):
  1. **Cover** — year, monthly average, hero number.
  2. **Top 5** — animated horizontal bars filling in on enter.
  3. **Biggest month** — month name + amount + a small bar chart of all 12 months.
  4. **Cancellations** — count + total annual saved + biggest single win.
  5. **ROI heroes / zombies** — two columns.
  6. **Category breakdown** — donut + ranked list.
  7. **Streaks** — longest no-new-subs run.
  8. **Closing card** — "Built with BurnRate" + a single CTA: *Download as PNG*.
- Animations respect `prefers-reduced-motion` (fall back to static reveals).
- PNG export via the existing `html2canvas` flow used by the v1 share card; capture each section as a single tall image.
- A second route `/report/[year]/opengraph-image.tsx` reuses the v2 `ImageResponse` pattern — but only renders when the user explicitly generates a **public** share link (Feature 5 of v2, extended).
- Public sharing: extend the v2 `/s/[payload]` share to include an optional `?report=YYYY` query string that flips the share page into a static report view.

### Trigger

- On the first boot of a calendar year (Jan 1 onward), if `isReportReady(year-1, ...)` is true and the previous year has not yet been generated (`preferences.annualReportsGenerated?: string[]`), show a celebratory banner: "Your <YEAR-1> recap is ready." Clicking opens `/report/<YEAR-1>`.
- Banner stays dismissible; users can always manually open prior years via Settings → Reports → "View <year>".

## Success Criteria
- [ ] `buildAnnualReport` is unit-tested in `src/lib/annual-report.test.ts` covering: all-zero state (graceful empties), partial year (6+ snapshots), full year, currency context across the year.
- [ ] `isReportReady` returns true at ≥ 6 snapshots in-year, false otherwise.
- [ ] Visiting `/report/2026` with no data shows a friendly empty state, not a 500.
- [ ] Scroll-driven animations honor `prefers-reduced-motion` (verified by toggling the OS preference or via media query in a Playwright spec).
- [ ] PNG export downloads a multi-section image; verified by clicking the CTA and inspecting the resulting blob's MIME and dimensions (one tall PNG, ≥ 1200px tall).
- [ ] OG image route only emits when `?report=YYYY` is present on a public `/s/[payload]` URL; otherwise the existing OG image renders.
- [ ] `preferences.annualReportsGenerated` records the year on first view; banner does not re-appear within the same year.
- [ ] Manual access to old reports works from Settings → Reports.
- [ ] Component test `AnnualReportPage.test.tsx` covers: cover renders, scroll triggers reveal class, download button calls the html2canvas helper.
- [ ] 375px viewport — every section renders within the viewport (no horizontal overflow); animations remain smooth (60fps target, but only required when reduced-motion is OFF).

---

# Feature 6 — Goal Engine v2

**Goal:** v2 budget caps and v2 savings targets are great but rigid. v5 generalizes them into a goal engine that supports per-category caps, no-new-sub streaks, and time-bound spending challenges with win/loss states.

## Implementation

### Data model

- Replace the v2 `BudgetGoal` slice with a richer `Goals` slice (the v2 budget cap and savings target become the first two goal types — migrate them in `migrate.ts`):
  ```ts
  export type GoalType =
    | 'monthly-cap'                          // total monthly spend ≤ X
    | 'category-cap'                         // monthly spend in category ≤ X
    | 'annual-savings'                       // saved ≥ X by date
    | 'no-new-subs-streak'                   // X consecutive days with no new sub added
    | 'monthly-cap-streak';                  // X consecutive months under the monthly cap

  export interface Goal {
    id: string;
    type: GoalType;
    label: string;
    createdAt: string;
    targetCents?: number;                    // for monetary types
    targetDays?: number;                     // for streak types
    targetMonths?: number;                   // for monthly-cap-streak
    targetDate?: string;                     // ISO for time-bound types
    categoryId?: string;                     // for category-cap (refs v4 CategoryDef.id)
    baselineCents?: number;                  // annual-savings baseline
    state: 'active' | 'achieved' | 'failed' | 'archived';
    achievedAt?: string;
    history: Array<{ at: string; event: 'created' | 'reset' | 'achieved' | 'failed' | 'milestone'; note?: string }>;
  }

  export interface GoalsState {
    items: Goal[];
  }
  ```
- Persist as `burnrate.goals.v2`. v2 budget storage (`burnrate.budget.v1`) is migrated and then left untouched (we keep the file readable for any rollback).

### Engine

- New module `src/lib/goals.ts`:
  ```ts
  export function evaluateGoals(state: AppState, fx: FxContext, now: Date): Goal[];
  export function progressOfGoal(goal: Goal, state: AppState, fx: FxContext, now: Date): GoalProgress;
  export function streakDaysWithoutNewSub(subs: Subscription[], now: Date): number;
  export function consecutiveMonthsUnderCap(snapshots: MonthlySnapshot[], capCents: number): number;
  ```
  with
  ```ts
  export interface GoalProgress {
    goalId: string;
    pct: number;                              // 0..1
    label: string;                            // "$120 of $200 saved"
    timeRemainingDays?: number;
    nextMilestoneCents?: number;
    nextMilestoneDays?: number;
    color: 'green' | 'amber' | 'red';
  }
  ```
- `evaluateGoals` is the boot-time sweep: transitions `active → achieved` when the metric meets the target, or `active → failed` when a time-bound goal's `targetDate` has passed without success. Both transitions append a `history` entry and emit a toast.
- Each transition records exactly one audit-log entry (v4 Feature 5).

### UI

- New `GoalsPanel.tsx` replaces `BudgetTracker.tsx`. It lists every goal with:
  - A progress bar (color from `GoalProgress.color`).
  - The label, time remaining, and next milestone.
  - A kebab menu: *Edit*, *Reset history*, *Archive*, *Delete*.
- "Add goal" form (inline) — typed dropdown selects the goal type, then reveals the relevant fields. Built-in starter goals shown when zero goals exist ("Stay under $50/mo", "Save $200 by year-end", "30 days no new subs").
- A new dashboard insight pack: when any goal is in `achieved` state, a celebratory "🎉 Goal achieved" card appears for 7 days. When any goal is in `failed` state, an "Goal expired without success — adjust or retry?" card appears.
- Command palette: "Add goal", "Show goals", and per-goal "Edit <label>" / "Archive <label>" commands.

## Success Criteria
- [ ] Migration from `burnrate.budget.v1` to `burnrate.goals.v2`: a v4 budget with monthly cap + savings target hydrates as exactly two goals.
- [ ] `evaluateGoals` is unit-tested in `src/lib/goals.test.ts` (≥ 18 cases) covering each goal type, the achieved transition, the failed-by-date transition, and idempotency on the same `now`.
- [ ] `streakDaysWithoutNewSub` returns 0 when a sub was added today, N when the most-recent sub was added N days ago, 0 when no subs exist.
- [ ] `consecutiveMonthsUnderCap` walks snapshots back from latest and stops at the first cap-exceeding month.
- [ ] Goals round-trip through CSV (`recordType=goal`) and `BR4.` sync.
- [ ] Adding a `category-cap` goal that references a deleted category is blocked at the form level.
- [ ] Component test `GoalsPanel.test.tsx`: empty state shows starter goals, add flow creates a persisted goal, achievement flow shows the celebration card.
- [ ] Boot-time evaluation emits at most one toast per transition (not per render).
- [ ] No regression in existing v3 budget-driven insights — they now reference the new goal engine.

---

# Feature 7 — Cancellation Coach

**Goal:** "Cancel one" is a one-click promise that hits a hard wall when the user is staring at a retention-flow phone tree. Give them the steps, the scripts, the gotchas, and a log of what they tried.

## Implementation

### Playbook catalog

- New file `src/data/cancellation-playbooks.ts`:
  ```ts
  export interface CancellationPlaybook {
    matchService: string[];                  // case-insensitive name match (e.g., ["Netflix", "netflix.com"])
    domain?: string;
    cancelUrl?: string;                      // deep link if available
    steps: string[];                         // ordered checklist of actions
    scripts: Array<{ label: string; body: string }>;  // copy-paste retention scripts
    gotchas: string[];                       // "They'll offer 50% off — accept or decline?"
    expectedRetentionOffer?: { kind: 'percent' | 'months-free' | 'tier-downgrade'; valueText: string };
    estimatedMinutes: number;                // realistic time budget
    lastVerifiedOn: string;                  // ISO — keep playbooks honest
  }
  ```
- Ship at minimum these playbooks: Netflix, Spotify, Hulu, Max, Disney+, Apple TV+, Apple Music, YouTube Premium, YouTube TV, Amazon Prime, Audible, Adobe Creative Cloud, Notion, Figma, ChatGPT Plus, Claude Pro, NordVPN, DoorDash DashPass, Peloton, Grammarly. Each entry: at least 3 steps, at least 1 script, at least 2 gotchas, an `estimatedMinutes`, and a `lastVerifiedOn`.

### Attempt log

- New persisted slice `burnrate.cancellation-attempts.v1`:
  ```ts
  export interface CancellationAttempt {
    id: string;
    subscriptionId: string;
    serviceName: string;
    startedAt: string;
    completedAt?: string;
    outcome?: 'cancelled' | 'kept' | 'downgraded' | 'discount-accepted' | 'abandoned';
    retentionOfferText?: string;
    note?: string;
    ledgerRecordId?: string;                 // linkback when the attempt becomes a ledger entry
  }
  ```

### Coach UI

- New component `CancellationCoach.tsx`. Opens as a side drawer (not a modal) so the user can keep the sub visible.
- Header: service name + matched playbook (or "No playbook for this service — generic steps below").
- Body: checklist of steps with checkboxes; copy-buttons for each script; collapsible "Gotchas to watch for"; an "Open cancellation page" button if `cancelUrl` is present.
- Footer: outcome picker — *Cancelled*, *Kept*, *Downgraded*, *Took discount*, *Abandoned*. Selecting an outcome closes the attempt:
  - `cancelled` → opens the v3 cancellation flow with `cancellingOn = today + 1`. Links the resulting ledger row to the attempt.
  - `downgraded` → updates the sub's `costCents` inline (prompt the user for the new cost).
  - `discount-accepted` → opens the v5 Feature 4 retention-log form prefilled.
  - `kept` / `abandoned` → records the attempt and closes; no other state change.
- Coach is reachable from:
  - The kebab menu on any subscription row ("Open cancellation coach").
  - The v5 Feature 1 UsageInsights cards (Cancel ghosts/zombies via the coach).
  - The v3 SmarterAlternatives "Cancel one" CTA (extended — now opens the coach instead of just the date picker).
  - The command palette: "Coach me through cancelling <name>".

### Attempts overview

- New Settings section **Cancellation attempts** shows the full attempt log with filters (outcome, date range). Each row has a "View linked ledger entry" affordance when applicable.
- A dashboard insight pack: "You've attempted N cancellations; you completed M; you kept K with a retention offer worth $X/yr." Surfaces only when the log has ≥ 3 entries.

## Success Criteria
- [ ] At least 20 playbooks ship in `cancellation-playbooks.ts`, each passing a runtime validity check (steps ≥ 3, scripts ≥ 1, gotchas ≥ 2, estimatedMinutes > 0, valid ISO `lastVerifiedOn`).
- [ ] Unit test in `src/data/cancellation-playbooks.test.ts` asserts the count and shape, and that every `matchService` entry has at least one lowercase variant.
- [ ] `CancellationCoach.tsx` matches a sub to a playbook by case-insensitive name; falls back to a generic playbook for unmatched services without breaking the flow.
- [ ] Attempt log persists in `burnrate.cancellation-attempts.v1` and round-trips through CSV (`recordType=cancellationAttempt`) and `BR4.` sync.
- [ ] Outcome `cancelled` correctly schedules the cancellation through the v3 flow and links the resulting ledger record's id back to the attempt.
- [ ] Outcome `discount-accepted` opens the v5 retention-log form prefilled with the service name and the user's typed offer text.
- [ ] Copy-script buttons place the script text on the clipboard with a toast; verified via the Clipboard API mock in tests.
- [ ] Coach drawer is keyboard-accessible — Tab traps inside while open, Esc closes, restored focus on close.
- [ ] Component test `CancellationCoach.test.tsx` covers: matched playbook render, no-playbook fallback, each outcome path, audit-log entry for the outcome.
- [ ] 375px viewport — drawer collapses to full-screen, footer outcome buttons stack vertically.

---

# Cross-Feature Polish (also required)

- **Settings tab grows.** Insert sections in this order after the v4 layout: *Reports* (Feature 5 — links to per-year reports), *Cancellation attempts* (Feature 7), then the existing v4 order. Keep each section collapsible.
- **Migration.** `migrateBurnRateData(stored): BurnRateData` in `src/lib/migrate.ts` handles the v4 → v5 schema bump. Tested with real v4 fixtures (or fixtures captured during v4 dev). Bump `SCHEMA_VERSION` to **5**.
- **Sync prefix bump.** Add `BR4.` carrying the v5-only fields (usage log, planned price changes, active discounts, expanded goals, cancellation attempts, annual reports state). Continue to read `BR1.`, `BR2.`, and `BR3.` indefinitely.
- **Dashboard modules updated.** Add `usage`, `calendar`, `retention` to `DASHBOARD_MODULES`. Default visibility: `usage` ON, `calendar` ON, `retention` ON when at least one discount exists else hidden by default.
- **Toast queue stays.** Boot-time toasts (price changes, goal transitions, discount expiry, auto-cancel) coalesce when there are more than 3 events at once.
- **A11y sweep.** Animated story (Feature 5) MUST respect `prefers-reduced-motion`; coach drawer (Feature 7) MUST trap focus.

## Cross-Feature Success Criteria
- [ ] V4 storage hydrates cleanly into v5 — fixture test asserts the resulting `BurnRateData` shape.
- [ ] Boot-time sweeps run in this order: snapshot capture (v3) → due cancellations (v3) → price changes (Feature 2) → goal evaluation (Feature 6) → discount expiry checks (Feature 4) → usage nudge (Feature 1) → annual-report banner (Feature 5).
- [ ] `npm run typecheck` and `npm test` stay green throughout.
- [ ] No console warnings on first load.

---

# Required Documentation Updates

- Update `README.md`:
  - Add v5 features to the feature list (Usage tracker + ROI, Price-change scheduler, Charge calendar, Retention/discount log, End-of-year report, Goal engine v2, Cancellation coach).
- Update `docs/architecture.md` to a "v5" version reflecting:
  - The new persisted slices (`burnrate.goals.v2`, `burnrate.cancellation-attempts.v1`).
  - The new pure libs (`usage.ts`, `price-changes.ts`, `charge-calendar.ts`, `discounts.ts`, `annual-report.ts`, `goals.ts`).
  - The new route `/report/[year]`.
  - The new boot-time sweep order.
  - The schema-version bump.
- Create `docs/progress/v5.md` and maintain it as you go (one section per feature, with Started / Decisions / Tests added / Verified).
- Mark `docs/specs/goal4.md` historical and reference `docs/specs/goal5.md` as the active goal.

---

# Final Verification Checklist

Before declaring the milestone complete, run every step below and confirm green. **Do not stop until every box can be checked.**

1. [ ] `npm run typecheck` → 0 errors.
2. [ ] `npm test` → all unit + component tests pass (target: ≥ 400 tests after v5).
3. [ ] `npm run build` → exits 0, produces a working `.next/` output.
4. [ ] `npm run dev` and manually walk through:
   - [ ] Boot on a new calendar month → usage check-in banner appears → record usage for 3 subs → ROI badges appear on rows.
   - [ ] Add a price change: Netflix +$2 on a date 2 months out → Trends forecast bends at that month.
   - [ ] Open Charge calendar → see contributions grid; the dominant-day-of-month insight names the correct day.
   - [ ] Add an active discount on Spotify (original $11.99, paying $5.99) → RetentionLog card shows monthly savings; expiry-soon emphasis appears when expiry < 14 days.
   - [ ] Visit `/report/<lastYear>` with at least 6 months of snapshots → scroll story renders end-to-end → Download PNG works.
   - [ ] Add a category-cap goal "Entertainment ≤ $30/mo" → exceed it next month (manual snapshot edit or wait) → goal transitions to `failed` with a toast and audit entry.
   - [ ] Open Cancellation Coach on Hulu → walk through the playbook → outcome "Cancelled" schedules the v3 cancellation and links the ledger row.
   - [ ] `BR1.`, `BR2.`, `BR3.` payloads from prior versions still decode.
   - [ ] PWA install still works; offline still serves the cached shell.
   - [ ] 375px viewport — every new screen and modal is usable; report scroll-story is readable; coach drawer is full-screen.
   - [ ] Light mode and dark mode both look correct on every new surface.
   - [ ] `prefers-reduced-motion: reduce` — report animations fall back to static reveals.
5. [ ] Lighthouse on `localhost:3000`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, PWA ≥ 90.
6. [ ] Home-route gzipped client JS ≤ 150KB (v4 baseline was ≤ 130KB; +20KB budget for the new surfaces — record before/after in the commit message).
7. [ ] `/report/[year]` route is dynamically rendered (not pre-rendered) and reads from localStorage on the client — no server data flow.
8. [ ] Vercel preview deploy succeeds; the deployed URL works end-to-end.
9. [ ] No new third-party scripts loaded at runtime. No LLM weights, no model files.
10. [ ] `socket scan` (if a token is available) reports 0 high-severity issues. Otherwise note "no token, skipped — manual review done."
11. [ ] Every feature's individual success-criteria list above is fully checked.

---

# Stopping Condition

**Stop only when every check above is green and the progress log shows every feature `Verified`.** If you hit an obstacle, document it in `docs/progress/v5.md`, attempt a workaround, and only escalate to a human if the workaround would violate a hard constraint above.
