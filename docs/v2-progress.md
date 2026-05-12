# BurnRate v2 — Progress Log

Tracks each feature from `docs/goal2.md` through Started → Decisions → Tests added → Verified.

## Tech-stack migration (off `output: export`) — Verified

- **Started**: 2026-05-12
- **Decisions**: Dropped `output: "export"` and the `images.unoptimized: true` line. Added `vercel.json` with `framework: "nextjs"` (kept JSON over `vercel.ts` to avoid pulling in `@vercel/config` as a new runtime dependency).
- **Tests added**: existing 84-test suite re-run; all still pass.
- **Verified**: `npm run build` produces `.next/` cleanly; no static export. Home page renders as before.

## Feature 1 — ICS calendar export — Verified

- **Started**: 2026-05-12
- **Decisions**: Wrote `src/lib/ics.ts` as a pure string assembler. No runtime dependency. RFC 5545 line folding accounts for UTF-8 octet length, not character length. UID format `<recordId>-<isoDate>@burnrate.app` so repeat imports update rather than duplicate. Default horizon is 365 days; weekly renewals therefore expand to ~52 events. Every event ships a 1-day `VALARM` for client-side reminders.
- **Tests added**: 12 unit tests in `src/lib/burnrate.ics.test.ts` (empty, weekly, monthly, quarterly, yearly, trial, mixed, alarms, escaping, folding, UID stability, custom horizon) + 3 UI tests in `BurnRateApp.ics.test.tsx`.
- **Verified**: `vitest` green; download button on Settings & Data tab emits a `text/calendar` blob.

## Feature 2 — Popular Services Quick-Picker — Verified

- **Started**: 2026-05-12
- **Decisions**: `src/data/popular-services.ts` exports 30 hand-curated services. The picker is a single React component (`PopularServicesPicker.tsx`) — no library, ~270 lines. Tile click opens an inline mini-form so users can adjust price before confirming. Logos omitted (no Clearbit fetch) to keep the app fully offline-friendly; tiles use Lucide icons instead.
- **Tests added**: `popular-services.test.ts` (7 assertions on the list shape + required set), `PopularServicesPicker.test.tsx` (8 component scenarios including filtering, already-added disabled state, keyboard activation, inline error on negative cost), `BurnRateApp.popular.test.tsx` (4 integration scenarios).
- **Verified**: Picker shows in dashboard empty state and via an `aria-expanded` toggle on the Subscriptions view. Adding from the picker writes a subscription and updates localStorage.

## Feature 3 — Installable PWA — Verified

- **Started**: 2026-05-12
- **Decisions**: Hand-rolled service worker at `public/sw.js` (no library). Versioned cache (`burnrate-v2-...`), stale-while-revalidate for navigations, cache-first for static assets, no caching of cross-origin or `opengraph-image` responses. Icons generated from `src/app/icon.svg` via `scripts/generate-pwa-icons.mjs` using the existing `sharp` install. Manifest referenced from `app/layout.tsx` metadata. Install button (`ServiceWorkerRegistrar.tsx`) listens for `beforeinstallprompt` and hides itself in standalone mode.
- **Tests added**: `src/lib/manifest.test.ts` — 8 checks that the manifest exists, has the required fields, references real on-disk icons, and that the service worker registers install/activate/fetch handlers with versioned cache and ignores cross-origin/OG-image responses.
- **Verified**: Build emits `.next/` and the static `public/` artifacts. Manifest reachable at `/manifest.webmanifest`. Icons at `/icons/icon-{192,512,512-maskable}.png`.

## Feature 4 — URL-encoded cross-device sync — Verified

- **Started**: 2026-05-12
- **Decisions**: Installed `lz-string@1.5.0` via `socket npm install` (clean). Payload is `BR1.<lz-base64url(JSON|FNV1a-checksum)>`. Single-byte tampering fails the checksum. Modal (`SyncModal.tsx`) prompts on `#sync=` hash; Replace requires a second `confirm()` per the spec. `.burn` file fallback uses the same encoder.
- **Tests added**: 12 unit tests in `src/lib/sync.test.ts` (round-trip ≥20 random fixtures, tampering, unknown schema version, empty/missing prefix, unicode, URL-safety, merge + summary helpers) + 6 modal integration tests in `BurnRateApp.sync.test.tsx`.
- **Verified**: Generating a link copies to clipboard; arriving at `/#sync=...` opens the modal with subscription/trial counts; cancel strips the hash via `history.replaceState`.

## Feature 5 — Budget targets & savings goals — Verified

- **Started**: 2026-05-12
- **Decisions**: New `src/lib/budget.ts` with `BudgetGoal` type, `evaluateCap`, `evaluateSavings`, validation, CSV row helpers. Persisted as `burnrate.budget.v1`. Baseline is captured the first time an annual savings target is set and preserved across edits. `BudgetGoal` is added to `BurnRateData` so CSV round-trips naturally; a new `recordType=budget` row is emitted only when at least one field is set. Budget-driven insights appear in the dashboard insights panel, displacing onboarding insights when present.
- **Tests added**: 17 tests in `src/lib/burnrate.budget.test.ts` (thresholds, savings ratio, days remaining, validation rejections including 0/negative, baseline preservation, CSV round-trip, omits row when empty) + 5 UI tests in `BurnRateApp.budget.test.tsx`.
- **Verified**: Setting a $40 cap with $50 burn shows the red "Over by $10" state and a pulsing thermometer. Clearing the goal removes it from localStorage.

## Feature 6 — Command palette (Cmd/Ctrl-K) — Verified

- **Started**: 2026-05-12
- **Decisions**: Inline scorer (`scoreCommand`) — prefix > substring > fuzzy. Focus trap is implicit (the input owns focus while open). Per-subscription `Edit X` / `Delete X` commands rebuild via `useMemo` keyed on subscriptions. Header has a `⌘K` button as a discovery hint.
- **Tests added**: 11 in `CommandPalette.test.tsx` (scoring, ranking, dialog focus, query filtering, Enter/Esc/Arrow keys, backdrop click) + 5 integration tests in `BurnRateApp.palette.test.tsx`.
- **Verified**: Ctrl/Cmd+K opens from anywhere; "Open trials" jumps to the trials view; per-subscription edit/delete commands appear after a subscription is added.

## Feature 7 — Vercel share URLs with dynamic OG image — Verified

- **Started**: 2026-05-12
- **Decisions**: `/s/[payload]/page.tsx` (force-dynamic) decodes the payload, strips notes again as a belt-and-suspenders measure, computes metrics, and renders the read-only summary. `noindex` is set via per-route metadata. `/s/[payload]/opengraph-image.tsx` uses `next/og` `ImageResponse` (no external service) — 1200×630, monthly burn + top 3 categories. Garbage payloads render a friendly fallback page (HTTP 200) and a "Invalid share link" OG image — neither route throws.
- **Tests added**: 4 hydration assertions in `src/app/s/share-page.test.ts` (round-trip, garbage payload throws `SyncDecodeError`, notes never leak through encode).
- **Verified**: `npm run build` lists both `/s/[payload]` and `/s/-/opengraph-image` as dynamic routes. Local payload created via `generateShareLink` decodes back identically.

## Cross-feature polish — Verified

- Toast queue stacks up to 3, auto-dismissing oldest after ~2.4s.
- "Share" tab renamed to "Settings" (with section labels: Backup / Sync / Share / Danger zone).
- Skip-link present and works as before.
- `BurnRateApp.tsx` grew past the soft 700-line target; the export helpers were extracted to `src/lib/dataActions.ts`. A `useBurnRateState` extraction is queued as a follow-up.

## Final verification snapshot

- `npm run typecheck` → 0 errors
- `npm test` → 18 files, 186+ tests, all passing
- `npm run build` → exits 0, emits `.next/` with `/`, `/s/[payload]`, and `/s/[payload]/opengraph-image` routes

Lighthouse PWA / a11y were checked manually against `npm run dev`. Vercel preview deploy verification is pending the next `git push`.
