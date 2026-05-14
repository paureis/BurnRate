# BurnRate v4 — Codex `/goal` Prompt

You are extending the **BurnRate** subscription tracker — a free, single-user, local-first web app already deployed on Vercel at `https://burnrate-bay.vercel.app`. The existing codebase is Next.js 16 + React 19 + TypeScript + Tailwind, with Recharts for visualizations, `localStorage` + IndexedDB for persistence, a service-worker-cached PWA shell, a `#sync=BR2.` cross-device flow, a `/s/[payload]` read-only share route with dynamic OG images, a Cmd/Ctrl-K command palette, multi-currency support across 22 ISO codes, a savings ledger, a passphrase lock with AES-GCM at-rest encryption, a paste-charges importer, and 266 unit tests plus a Playwright smoke spec.

This fourth milestone shifts BurnRate from *capable* to *pleasant under heavy use*. It adds **seven features** themed around power-user ergonomics: bulk operations, structured filtering, customizable layout, advanced search, undo history, custom taxonomy, and portable settings. You must implement every feature, write tests for every feature, and meet every success criterion before stopping.

---

## Hard Constraints (do not violate)

- **Free hosting only.** Vercel Hobby tier or equivalent. No paid services. No paid APIs. No external secrets. No FX rate APIs (continue using bundled static rates).
- **Storage is the user's browser.** `localStorage`, `IndexedDB`, and `sessionStorage` are allowed. No database, no auth, no account creation, no telemetry that collects personal data.
- **No new runtime dependencies that aren't free and permissively licensed.** Prefer MIT / Apache-2.0 / ISC. Avoid heavy bundles — if a feature can be done in <300 lines without a library, do it inline. No drag-and-drop library; use the native HTML5 drag API or Pointer Events.
- **Package security.** Use `socket npm install` for every new package. Never bare `npm install`. Use `npm ci` only from a lockfile. Honor the global `.npmrc` (`save-exact=true`, `ignore-scripts=true`, `audit=true`, `audit-level=high`).
- **No tracking, no fingerprinting, no third-party analytics scripts** beyond Vercel's built-in Web Analytics (already optional via env flag).
- **TypeScript strict.** No `any`. No `// @ts-ignore` unless paired with a one-line justification comment.
- **Accessibility regression-free.** Every new interactive element needs proper ARIA, keyboard support, focus-visible states, and works at 200% zoom. Drag interactions must have a keyboard equivalent (move-up / move-down buttons or arrow-key reorder).
- **Mobile-first.** Every new screen/component must look right at 375px width.
- **Backwards compatible storage.** Any change to `BurnRateData`, `Subscription`, or related shapes must include a one-shot migration from the v3 layout. Reading a v3 `localStorage` blob must hydrate cleanly without data loss.
- **Sync links remain backward compatible.** `BR1.` and `BR2.` payloads must still decode. Bump to `BR3.` when carrying v4-only fields (tags, audit log, custom categories, dashboard layout).
- **Run `npm run build`, `npm run typecheck`, and `npm test` after every feature.** Build must exit 0. Tests must pass. Zero TypeScript errors.

---

# Feature 1 — Multi-Select & Bulk Editor

**Goal:** Eliminate the row-at-a-time edit grind. Users select any number of subscriptions and apply a single edit (category, cycle, currency, cancel-on, delete) to all of them in one action.

## Implementation

### Selection state

- Add a non-persisted `selectedIds: Set<string>` to `BurnRateApp.tsx` (or the equivalent state slice). Selection clears on view change.
- Each subscription row gains a leading checkbox (visible only on the Subscriptions view; hidden on Dashboard). The checkbox toggles inclusion in `selectedIds`.
- A header-level "Select all" checkbox toggles all currently-filtered rows. It reflects an indeterminate state when some-but-not-all are selected.
- Keyboard: `Shift+Click` selects a range; `Cmd/Ctrl+A` on the Subscriptions view selects all (do not hijack browser select-all inside text inputs).

### Bulk action bar

- New component `src/components/BulkActionBar.tsx`. Renders a sticky bar at the bottom of the Subscriptions view when `selectedIds.size > 0`, anchored to the viewport (`position: sticky; bottom: 0`), with a backdrop blur and clear "X selected" count.
- Actions (each opens an inline mini-form, not a modal):
  - **Change category** — dropdown of all categories (including v4 custom ones from Feature 6) → apply.
  - **Change billing cycle** — dropdown of weekly/monthly/quarterly/yearly → apply (recompute `nextBillingDate` only if the cycle math demands it; preserve current `nextBillingDate` otherwise).
  - **Change currency** — currency dropdown → apply (native cost stays the same numerically; only the `currency` field changes — show a "we are not converting the amount" hint).
  - **Set cancel-on date** — inline date picker; default: 1 day before the soonest `nextBillingDate` among selected → apply via the existing v3 cancellation flow.
  - **Add tag(s)** / **Remove tag(s)** — Feature 2 hookup.
  - **Delete** — confirm dialog showing the count and names; deletion is itself one undo-able audit entry (Feature 5).
- Action confirmation toast: "Updated 7 subscriptions" with an inline "Undo" affordance hooked into Feature 5.

### Pure bulk-update helpers

- New module `src/lib/bulk.ts`:
  ```ts
  export function applyBulkPatch(
    subs: Subscription[],
    selectedIds: ReadonlySet<string>,
    patch: Partial<Subscription> & { tagsAdd?: string[]; tagsRemove?: string[] },
  ): { next: Subscription[]; changedCount: number };

  export function applyBulkDelete(
    subs: Subscription[],
    selectedIds: ReadonlySet<string>,
  ): { next: Subscription[]; deleted: Subscription[] };
  ```
- These are **pure** — no side effects — so the audit log (Feature 5) can capture before/after snapshots cleanly.

## Success Criteria
- [ ] `applyBulkPatch` and `applyBulkDelete` are unit-tested in `src/lib/bulk.test.ts` covering: empty selection (no-op), partial selection, patch with multiple fields, `tagsAdd` deduplication, `tagsRemove` is a no-op when the tag isn't present.
- [ ] Selection state is non-persistent — reloading the page clears `selectedIds`.
- [ ] Header "Select all" toggles only filtered rows (i.e., a category filter limits the scope of select-all).
- [ ] `Shift+Click` range-selects between the last clicked checkbox and the current one.
- [ ] `BulkActionBar` is keyboard-navigable: Tab cycles through the actions, Enter activates.
- [ ] The bar's sticky positioning does not overlap the last row on a 375px viewport (verify with the inspector / Playwright).
- [ ] Each bulk action emits exactly one audit-log entry (Feature 5) — even when modifying 50 subs at once.
- [ ] Component test `BulkActionBar.test.tsx` covers: bar hidden at 0 selected, bar shows at ≥1, action menus open, change-category flow applies to all selected, delete confirm + cancel paths.
- [ ] No regression in single-row inline editing.

---

# Feature 2 — Tags & Saved Views

**Goal:** Categories are coarse (`Entertainment`, `Productivity`). Tags let users slice the same data orthogonally (`#work`, `#couple`, `#kids`, `#trial-of`). Saved views capture a filter + sort + scope combination as a one-click destination.

## Implementation

### Tags on the model

- Add an optional field to `Subscription` and `Trial`:
  ```ts
  tags?: string[];   // lowercase, kebab-case, deduped, ≤ 20 chars each, ≤ 10 tags per record
  ```
- Tag normalization helper in `src/lib/tags.ts`:
  ```ts
  export function normalizeTag(input: string): string | null;        // returns null if invalid
  export function mergeTags(existing: string[] | undefined, incoming: string[]): string[];
  export function collectAllTags(subs: Subscription[], trials: Trial[]): string[];  // sorted, unique
  ```
- UI: a tag input on the add/edit form (chip-style) with autocomplete from `collectAllTags`. Pressing Enter / `,` / space commits the tag. Backspace on empty input removes the last chip.

### Saved views

- New module `src/lib/views.ts`:
  ```ts
  export interface SavedView {
    id: string;
    name: string;                          // user-visible
    scope: 'subscriptions' | 'trials';
    filter: {
      query?: string;                      // free text — substring match on name + notes
      tags?: string[];                     // AND across tags
      categories?: string[];               // OR within categories
      cycles?: BillingCycle[];             // OR
      currencies?: string[];               // OR
      minMonthlyCents?: number;
      maxMonthlyCents?: number;
      cancellingOnly?: boolean;
    };
    sort: { by: 'name' | 'cost' | 'nextBillingDate' | 'category'; dir: 'asc' | 'desc' };
    createdAt: string;
    updatedAt: string;
  }

  export function applyView(subs: Subscription[], view: SavedView, fx: FxContext): Subscription[];
  ```
- Persist as `burnrate.views.v1`. Ship with **three** built-in views that are not deletable (but can be hidden): *All subscriptions*, *Yearly only*, *Cancelling soon*. Built-ins are seeded on first boot if the store is empty.
- New component `src/components/SavedViews.tsx` rendered as a horizontal pill row above the Subscriptions list. Clicking a pill applies the view. The active pill is highlighted.
- "Save current filters as view" action in the filter bar opens a small inline form (name + scope). "Update existing view" appears when the active view's filters were modified.
- Each user-created view has a kebab menu: *Rename*, *Update with current filters*, *Delete*.
- Command palette: "Open view: [name]" appears for each view; "Save view" command opens the save form.

## Success Criteria
- [ ] `normalizeTag` rejects: empty string, > 20 chars, non-ASCII (allow letters/digits/hyphen only), surrounding whitespace.
- [ ] Tag input dedupes case-insensitively (adding `Work` then `WORK` results in one `work` chip).
- [ ] `mergeTags` and `collectAllTags` are unit-tested in `src/lib/tags.test.ts`.
- [ ] `applyView` is unit-tested in `src/lib/views.test.ts` covering each filter dimension plus combinations (e.g., tag + category + min/max + sort).
- [ ] Built-in views seed on first boot; deleting a user view persists; built-ins cannot be deleted (UI hides the delete action).
- [ ] Saved views round-trip through CSV (`recordType=view`) and sync (`BR3.`).
- [ ] Tags round-trip through CSV (new column) and sync.
- [ ] Component test `SavedViews.test.tsx`: pills render, click switches active, save flow creates a new persisted view.
- [ ] Migration: v3 records without `tags` hydrate with `tags: undefined`. Tag input on edit appends to an empty array seamlessly.

---

# Feature 3 — Customizable Dashboard Layout

**Goal:** The dashboard now stacks 7+ modules (Hero, Budget, Pending, Smarter, Trends, Ledger, Insights, Donut, Renewals). Power users want to hide noise and reorder. Mobile users want a tighter default.

## Implementation

### Layout slice in preferences

- Extend `BurnRatePreferences` (introduced in v3 at `burnrate.preferences.v1`) with:
  ```ts
  dashboardLayout?: Array<{ moduleId: DashboardModuleId; visible: boolean }>;
  ```
- New const `DASHBOARD_MODULES: readonly DashboardModuleId[]` in `src/lib/dashboard-layout.ts` enumerating the canonical module set: `hero | budget | pending | smarter | trends | ledger | insights | donut | renewals | usage` (`usage` is reserved for v5 — keep it in the enum but ignore if absent).
- Module metadata: `{ id, label, defaultVisible, description }` so the layout editor can render an explanation per module.
- Helper:
  ```ts
  export function resolveDashboardLayout(
    stored: BurnRatePreferences['dashboardLayout'],
    available: readonly DashboardModuleId[],
  ): Array<{ moduleId: DashboardModuleId; visible: boolean }>;
  ```
  This merges the stored order with any newly-released modules (appended at default position, default visibility).

### Reorder UI

- Add a "Customize dashboard" command (palette + a header gear icon) that opens a `DashboardLayoutEditor.tsx` panel — rendered inline inside Settings, not as a modal.
- The editor lists every module with: a drag handle, a visibility toggle, and up/down buttons (for keyboard users).
- Pointer drag uses **Pointer Events** (no library). Keyboard equivalent: Tab to a row, Enter to "pick up," `↑/↓` to move, Enter to drop, Esc to cancel.
- "Reset to default" button restores the canonical order with default visibility.
- Live preview: as the user reorders, the dashboard reflects the change immediately (the layout is read on every render).

### Dashboard render path

- Refactor `Dashboard.tsx` to take a `layout: Array<{ moduleId; visible }>` prop and render modules in that order, skipping hidden ones. Keep `BurnRateApp.tsx`'s composition stable — no behavior change other than ordering and visibility.

## Success Criteria
- [ ] `resolveDashboardLayout` is unit-tested: missing storage → defaults; stored order with one new module → new module appended; stored order with a removed module → ignored.
- [ ] Pointer drag works on desktop and touch (verified manually with the mobile-emulator).
- [ ] Keyboard reorder works: pick up → ↑/↓ → drop, fully accessible.
- [ ] Hiding `renewals` removes it from the dashboard without breaking the rest.
- [ ] Reset-to-default restores the documented canonical order.
- [ ] Layout persists across reload and round-trips through `BR3.` sync.
- [ ] Component test `DashboardLayoutEditor.test.tsx` covers: render list, toggle visibility, move-up, move-down, reset.
- [ ] No layout shift > 0.1 CLS on dashboard render after a reorder.

---

# Feature 4 — Search Operators in the Command Palette

**Goal:** The palette already supports fuzzy name matching. Power users want structured queries: `cost:>20 cycle:yearly tag:work` to surface exactly the subscriptions they care about.

## Implementation

### Query parser

- New module `src/lib/palette-query.ts`:
  ```ts
  export interface ParsedPaletteQuery {
    freeText: string;                            // remaining substring after operators are stripped
    filters: {
      costMinCents?: number;
      costMaxCents?: number;
      cycles?: BillingCycle[];
      tags?: string[];
      categories?: string[];
      currencies?: string[];
      cancellingOnly?: boolean;
      trialsOnly?: boolean;
    };
  }

  export function parsePaletteQuery(input: string): ParsedPaletteQuery;
  ```
- Supported operators (case-insensitive, repeatable):
  - `cost:>20`, `cost:<5`, `cost:>=10`, `cost:<=50` — interpret the number as the user's base currency, convert as needed when matching.
  - `cycle:weekly|monthly|quarterly|yearly`
  - `tag:work` (repeatable — multiple `tag:` means AND)
  - `category:entertainment` (repeatable — OR)
  - `currency:eur` (repeatable — OR)
  - `cancelling:` (boolean — match any sub with `cancellingOn` set)
  - `trial:` (boolean — match trials only)
- The parser must tolerate sloppy input: unknown operators are left in `freeText` (the user sees their substring still applied), unparseable values fall back to `freeText`.

### Palette integration

- Extend `CommandPalette.tsx` to call `parsePaletteQuery(input)` and use the resulting filter set when ranking subscription-derived commands (`Edit <name>`, `Delete <name>`). Free text remains the existing fuzzy matcher.
- When at least one operator is present, show a one-line query summary above the result list: `Filtering: 3 yearly subs over $20 tagged "work"`.
- Add a tiny "Show all operators" affordance that opens a one-pager help drawer inline (no modal): list operators and examples.

## Success Criteria
- [ ] `parsePaletteQuery` is unit-tested in `src/lib/palette-query.test.ts` covering: each operator, repeated operators, mixed operators + free text, unknown operator preserved in `freeText`, malformed numbers fall through.
- [ ] Cost matching converts to the user's base currency when comparing (i.e., `cost:>20` matches a £15 sub if base is USD and 15 GBP ≈ $19 → no, but matches a €25 sub if base USD and €25 ≈ $27 → yes). Test with fixture FX.
- [ ] When parsing fails the palette never throws — it returns the free-text path.
- [ ] Operator queries surface only matching subs; commands like "Open dashboard" remain accessible (operators only narrow record-derived commands).
- [ ] Query summary line renders only when at least one operator parsed.
- [ ] "Operators help" drawer opens, is keyboard-accessible, and lists every supported operator with at least one example each.
- [ ] Component test `CommandPalette.operators.test.tsx` covers typing `cycle:yearly` and seeing only yearly subs.

---

# Feature 5 — Undo History & Audit Log

**Goal:** Every destructive or large change can be undone or inspected. A 20-entry ring buffer captures who-did-what-when across the app — without growing storage unboundedly.

## Implementation

### History module

- New module `src/lib/history.ts`:
  ```ts
  export type HistoryOp =
    | 'addSubscription' | 'updateSubscription' | 'deleteSubscription'
    | 'bulkUpdate' | 'bulkDelete'
    | 'addTrial' | 'updateTrial' | 'deleteTrial' | 'convertTrial'
    | 'setCancellingOn' | 'undoCancellation' | 'applyDueCancellation'
    | 'addLedger' | 'deleteLedger'
    | 'updateBudget' | 'updatePreferences'
    | 'addView' | 'updateView' | 'deleteView'
    | 'addCategory' | 'updateCategory' | 'deleteCategory'   // Feature 6
    | 'importProfile' | 'importCsv';                         // bulk imports get one entry

  export interface HistoryEntry {
    id: string;                       // ULID-ish: timestamp + 6 random chars
    ts: string;                       // ISO
    op: HistoryOp;
    summary: string;                  // one-line human description ("Deleted 3 subscriptions: Netflix, Hulu, Max")
    before: unknown;                  // JSON-safe slice needed to undo
    after: unknown;                   // JSON-safe slice after the change
    affectedRecordIds?: string[];
  }

  export function record(entry: Omit<HistoryEntry, 'id' | 'ts'>): HistoryEntry;
  export function prune(entries: HistoryEntry[], limit?: number): HistoryEntry[];   // default 20
  export function buildSummary(op: HistoryOp, before: unknown, after: unknown): string;
  ```
- Persist as `burnrate.history.v1`. Capped at **20** entries. Pruned oldest-first on every write.
- A small wrapper hook `useHistory` exposes `entries`, `record(op, before, after, ids?)`, `undoEntry(id)`, and `clear()`.

### Wiring mutations

- Every state-mutator callback in `BurnRateApp.tsx` (add/update/delete sub, set cancel-on, add/delete ledger, etc.) records exactly one entry. Bulk operations record one entry, not N.
- Auto-cancellation sweep (`applyDueCancellations`) records a single `applyDueCancellation` entry per boot if any rows were processed.
- Undo flow: the entry carries a typed `before` slice — applying it restores the exact prior state of the affected records. Recording the undo itself does **not** push a new entry (it removes the entry being undone instead). This keeps the ring buffer the user's "what just happened" feed, not a wrestling match.

### UI

- New component `src/components/HistoryDrawer.tsx`, opened by a header clock icon and by a "Show history" palette command.
- Each row renders: timestamp (relative), op label, summary, an Undo button (disabled if older than the most recent operation on that record — i.e., the undo would step on a newer change), and a "details" disclosure that pretty-prints `before`/`after`.
- Toast on Undo: "Restored 3 subscriptions" with a 7-second auto-dismiss.
- Add an "Undo last" command (palette + `Ctrl/Cmd+Z` on the Subscriptions view only — avoid intercepting browser undo elsewhere).

### Storage discipline

- Limit each entry's `before`/`after` payload to ~8 KB serialized; for bulk operations exceeding that, store an aggregate summary instead of full deltas and disable the row's Undo button with a "history payload too large to undo" tooltip.

## Success Criteria
- [ ] `record`, `prune`, and `buildSummary` are unit-tested in `src/lib/history.test.ts` covering: ring-buffer pruning at 20, ID uniqueness across 1000 rapid calls, summary copy for each `HistoryOp`.
- [ ] Single-sub add → audit row appears with op=`addSubscription`, summary names the service.
- [ ] Bulk delete of 5 subs → exactly one row with `affectedRecordIds.length === 5`.
- [ ] Undo on the bulk-delete row restores all 5.
- [ ] Auto-cancellation sweep on app boot records exactly one entry if any cancellations were processed.
- [ ] Undoing an entry removes it from the ring (it doesn't push a redo entry).
- [ ] `Ctrl/Cmd+Z` on the Subscriptions view triggers Undo Last; same shortcut inside a text input falls through to the browser.
- [ ] Component test `HistoryDrawer.test.tsx` covers: drawer renders entries, Undo button is enabled/disabled correctly, details disclosure expands.
- [ ] History round-trips through `BR3.` sync (truncated to 20 entries on the receiving device).

---

# Feature 6 — Custom Categories

**Goal:** The hardcoded `defaultCategories` list doesn't fit every workflow. Users add their own (`Subscriptions for the dog`, `Tools for the side hustle`) with their own color and icon.

## Implementation

### Category model

- New persisted shape at `burnrate.categories.v1`:
  ```ts
  export interface CategoryDef {
    id: string;                       // stable, lowercase-kebab
    label: string;                    // user-visible
    color: string;                    // hex
    icon: string;                     // lucide-react icon name (validated against the bundled icon set)
    builtIn: boolean;                 // true for the v1 defaults
    order: number;                    // sort order for pickers
  }
  ```
- Seed built-ins from the existing `defaultCategories` list. Built-ins cannot be deleted but can be edited (label, color, icon, order) and hidden.
- New module `src/lib/categories.ts`:
  ```ts
  export function loadCategories(stored: unknown): CategoryDef[];   // seeds built-ins if empty
  export function isReferenced(catId: string, subs: Subscription[], trials: Trial[]): boolean;
  export function mergeOnImport(existing: CategoryDef[], incoming: CategoryDef[]): CategoryDef[];
  export const BUILT_IN_CATEGORY_IDS: readonly string[];
  ```

### Migration from v3

- `Subscription.category` (and `Trial.category`) currently store a label string. Migrate to a category **id** the first time v4 boots:
  - For each sub, look up the built-in category whose `label` matches case-insensitively → store its `id`.
  - Anything that doesn't match becomes a new user category with `id = slugify(label)`, color seeded from a deterministic hash of the label, icon defaulting to `tag`.
- Migration helper `migrateCategoriesV3toV4` in `src/lib/migrate.ts`. Idempotent.

### UI

- New `CategorySettings.tsx` panel under Settings. Lists every category with: a colored badge (icon + label), a kebab menu (*Edit*, *Hide* (built-in only), *Delete* (user-only, blocked if referenced)), and drag-to-reorder (Pointer Events; keyboard ↑/↓ equivalent).
- Add/edit form: label, color (8-swatch palette + free hex input), icon (searchable picker of the bundled lucide set; cap at ~120 icons to keep bundle size reasonable).
- Subscription add/edit form and bulk action: dropdown lists categories in `order`; hidden built-ins do not appear unless the sub already references one.
- The donut chart legend uses the category color from the registry — not the previous hardcoded map.

## Success Criteria
- [ ] `loadCategories(undefined)` returns built-ins seeded with the v3 default colors and labels.
- [ ] `isReferenced` returns true when any sub/trial references the id; false otherwise.
- [ ] Migration test in `src/lib/migrate.test.ts` covers: every v3 sub's category label maps to a built-in id; unknown labels become user categories with deterministic colors.
- [ ] Deleting a user category is blocked with a clear message when at least one record references it; bulk-reassign action offered as the fix.
- [ ] Editing a built-in's color updates the donut chart immediately.
- [ ] Hiding a built-in removes it from pickers but does not orphan existing subs.
- [ ] Category storage round-trips through CSV (`recordType=category`) and `BR3.` sync.
- [ ] Component test `CategorySettings.test.tsx` covers: list render, edit flow, delete-blocked path, reorder, icon picker.
- [ ] No regression in popular-services picker — its hardcoded categories resolve to built-in ids via the migration map.

---

# Feature 7 — Profile Export / Import

**Goal:** A user setting up BurnRate on a new device shouldn't have to redo their theme, currency, FX overrides, layout, custom categories, and saved views. A `.burnprofile` file carries **settings only** — no data, no subs, no ledger — and can be applied to any install.

## Implementation

### File shape

- New module `src/lib/profile.ts`:
  ```ts
  export const PROFILE_SCHEMA_VERSION = 1;

  export interface BurnRateProfile {
    schemaVersion: 1;
    exportedAt: string;
    appVersion: string;                          // pulled from package.json at build time
    theme?: 'light' | 'dark' | 'system';
    preferences?: BurnRatePreferences;           // base currency, FX overrides, auto-lock minutes, dashboardLayout
    views?: SavedView[];                         // user-created views only
    categories?: CategoryDef[];                  // user-created + edits to built-ins
    notificationOptIns?: Record<string, boolean>;
  }

  export function exportProfile(state: AppState): BurnRateProfile;
  export function applyProfile(state: AppState, profile: BurnRateProfile, opts: { strategy: 'merge' | 'replace' }): AppState;
  export function validateProfile(input: unknown): { ok: true; profile: BurnRateProfile } | { ok: false; reason: string };
  ```
- The export file is JSON with a `.burnprofile` extension. MIME: `application/json`.

### UI

- New Settings sub-section **Profile** (sits between *Backup* and *Sync*):
  - "Export profile" button → downloads `burnrate-profile-<YYYY-MM-DD>.burnprofile`.
  - "Import profile" button → opens a file picker, validates, then shows a two-step confirm:
    1. **Preview** — diff of what will change ("Theme: dark → system", "FX overrides: 3 currencies will be added/changed", "Saved views: 2 new, 1 renamed", "Categories: 1 new, 0 deleted").
    2. **Choose strategy** — Merge (default) or Replace.
- Imports record one `importProfile` history entry (Feature 5) with the full diff in `before`/`after`.
- Errors: missing fields, wrong schema version, malformed JSON each show a friendly inline error with the failing reason.

### Command palette

- Add "Export profile" and "Import profile" commands.

## Success Criteria
- [ ] `exportProfile` produces a JSON blob whose shape passes `validateProfile`.
- [ ] `validateProfile` rejects: non-object input, wrong `schemaVersion`, missing `exportedAt`, FX overrides containing non-numeric rates.
- [ ] `applyProfile` with `strategy: 'merge'` adds new views/categories and updates preferences without overwriting unrelated state; `strategy: 'replace'` overwrites the settings slices entirely (data slices — subs, trials, ledger, snapshots — are **untouched** in both modes).
- [ ] Round-trip test in `src/lib/profile.test.ts`: export → import (merge) → identical settings shape.
- [ ] Profile import does **not** modify subscriptions, trials, ledger, snapshots, vault meta.
- [ ] Importing a profile from a different app version (e.g., `appVersion: "3.x"`) succeeds when `schemaVersion` is the same.
- [ ] Component test `ProfileImportFlow.test.tsx` covers: file picker → preview diff → confirm path applies, cancel path leaves state unchanged.
- [ ] One history entry recorded per import.

---

# Cross-Feature Polish (also required)

- **Settings tab grows again.** New section order: *Currency* (v3) → *Security* (v3) → *Profile* (Feature 7) → *Goals* (v2) → *Categories* (Feature 6) → *Dashboard layout* (Feature 3) → *Saved views* (Feature 2) → *Backup* (CSV, ICS, .burn) → *Bulk add* (v3 importer) → *Sync* → *Share* → *Danger zone*. Each section remains collapsible if total height exceeds ~1500px on desktop; mobile stacks linearly.
- **Migration.** A `migrateBurnRateData(stored): BurnRateData` function in `src/lib/migrate.ts` handles the v3 → v4 schema bump. Tested with real v3 fixtures. Bump `SCHEMA_VERSION` to **4**.
- **Sync prefix bump.** Add `BR3.` carrying the v4-only fields (tags, audit log, custom categories, dashboard layout, views). Continue to **read** `BR1.` and `BR2.` indefinitely.
- **`useBurnRateState` extraction (carry-over from v3 Feature 6).** Now that mutations are wrapped by Feature 5, this is the right moment to extract them. Pull state, derived data, and mutator callbacks into `src/hooks/useBurnRateState.ts`. `BurnRateApp.tsx` drops below **500 lines** (excluding imports/blank lines). If it doesn't, split a view component (DashboardView / SubscriptionsView / SettingsView).
- **Toast queue stays.** No regressions to the v2 toast queue.
- **A11y sweep.** Drag interactions (Features 3 and 6) MUST have keyboard equivalents. Run an axe check on every new screen and fix violations.

## Cross-Feature Success Criteria
- [ ] V3 storage hydrates cleanly into v4 — verified by a fixture test that loads every v3 storage key and asserts the resulting `BurnRateData` shape.
- [ ] Settings tab sections render in the documented order.
- [ ] `BurnRateApp.tsx` is under **500 lines**; `useBurnRateState` exists with its own unit tests.
- [ ] `npm run typecheck` and `npm test` stay green throughout.
- [ ] No console warnings on first load.

---

# Required Documentation Updates

- Update `README.md`:
  - Add v4 features to the feature list (Bulk editor, Tags + Saved Views, Customizable dashboard, Search operators, Audit log, Custom categories, Profile export).
  - Mention `.burnprofile` files and how they differ from `.burn` data files.
- Update `docs/architecture.md` to a "v4" version reflecting:
  - The new `useBurnRateState` hook.
  - The new persistent stores (`burnrate.views.v1`, `burnrate.categories.v1`, `burnrate.history.v1`, plus the `dashboardLayout` field in preferences).
  - The new pure libs (`bulk.ts`, `tags.ts`, `views.ts`, `dashboard-layout.ts`, `palette-query.ts`, `history.ts`, `categories.ts`, `profile.ts`).
  - The schema-version bump and migration entry point.
- Create `docs/progress/v4.md` and maintain it as you go (one section per feature, with Started / Decisions / Tests added / Verified).
- Mark `docs/specs/goal3.md` historical (add the same `[COMPLETED]` banner used on `goal.md` and `goal2.md`) and reference `docs/specs/goal4.md` as the active goal.

---

# Final Verification Checklist

Before declaring the milestone complete, run every step below and confirm green. **Do not stop until every box can be checked.**

1. [ ] `npm run typecheck` → 0 errors.
2. [ ] `npm test` → all unit + component tests pass (target: ≥ 320 tests after v4).
3. [ ] `npm run build` → exits 0, produces a working `.next/` output.
4. [ ] `npm run dev` and manually walk through:
   - [ ] Empty dashboard → add 5 subs via the popular picker → select all → bulk-change category to a new custom category → totals update, donut updates.
   - [ ] Tag two subs with `#work`, save view "Work subs" → reload → view persists and is one click away.
   - [ ] Open palette, type `cycle:yearly cost:>50` → only yearly subs over $50 appear.
   - [ ] Reorder dashboard so Trends is above Budget; hide Renewals → reload → layout persists.
   - [ ] Delete 3 subs → history drawer shows one bulk entry → Undo restores all 3.
   - [ ] Create a custom category "Side hustle" with a green color → assign to one sub → donut shows the green slice.
   - [ ] Export profile → import on a fresh browser profile via Merge → theme, currency, FX, views, categories all carried over; subs untouched.
   - [ ] `BR1.` and `BR2.` payloads from prior versions still decode.
   - [ ] PWA install still works; offline still serves the cached shell.
   - [ ] 375px viewport — every new screen and modal is usable; bulk-action bar does not occlude the last row.
   - [ ] Light mode and dark mode both look correct on every new surface.
5. [ ] Lighthouse on `localhost:3000`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, PWA ≥ 90.
6. [ ] Home-route gzipped client JS ≤ 130KB (v3 baseline was ≤ 110KB; +20KB budget for the new surfaces — record before/after in the commit message).
7. [ ] Vercel preview deploy succeeds; the deployed URL works end-to-end.
8. [ ] No new third-party scripts loaded at runtime.
9. [ ] `socket scan` (if a token is available) reports 0 high-severity issues. Otherwise note "no token, skipped — manual review done."
10. [ ] Every feature's individual success-criteria list above is fully checked.

---

# Stopping Condition

**Stop only when every check above is green and the progress log shows every feature `Verified`.** If you hit an obstacle, document it in `docs/progress/v4.md`, attempt a workaround, and only escalate to a human if the workaround would violate a hard constraint above.
