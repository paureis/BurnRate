# BurnRate v2 — Codex `/goal` Prompt  [COMPLETED — 2026-05-12]

> **DO NOT USE THIS FILE.** All seven features below were implemented, tested, and shipped.
> See `docs/v2-progress.md` for the per-feature progress log and `docs/architecture.md` for the resulting runtime data flow.
>
> Kept for historical reference only.

---

You are extending the **BurnRate** subscription tracker — a free, single-user web app already deployed on Vercel at `https://burnrate-bay.vercel.app`. The existing codebase is a Next.js 16 + React 19 + TypeScript + Tailwind app with Recharts for visualizations and `localStorage` for persistence. All current core features (subscriptions, trials, dashboard, simulator, CSV import/export, share PNG) are working and must continue to work.

This second milestone adds **seven high-leverage features** in a single coordinated effort. You must implement every feature, write tests for every feature, and meet every success criterion before stopping.

---

## Hard Constraints (do not violate)

- **Free hosting only.** Vercel Hobby tier or equivalent. No paid services. No paid APIs. No external secrets.
- **Storage is the user's browser.** `localStorage`, `IndexedDB`, and `sessionStorage` are allowed. No database, no auth, no account creation, no telemetry that collects personal data.
- **No new runtime dependencies that aren't free and permissively licensed.** Prefer MIT / Apache-2.0 / ISC. Avoid heavy bundles — if a feature can be done in <200 lines without a library, do it inline.
- **Package security.** Use `socket npm install` for every new package. Never bare `npm install`. Use `npm ci` only from a lockfile. Honor the global `.npmrc` (`save-exact=true`, `ignore-scripts=true`, `audit=true`, `audit-level=high`).
- **No tracking, no fingerprinting, no third-party analytics scripts** beyond Vercel's built-in Web Analytics (which is privacy-friendly and free) — and only add that if explicitly enabled by an env flag.
- **TypeScript strict.** No `any`. No `// @ts-ignore` unless paired with a one-line justification comment.
- **Accessibility regression-free.** Every new interactive element needs proper ARIA, keyboard support, focus-visible states, and works at 200% zoom.
- **Mobile-first.** Every new screen/component must look right at 375px width.
- **Run `npm run build`, `npm run typecheck`, and `npm test` after every feature.** Build must exit 0. Tests must pass. Zero TypeScript errors.

## Tech-Stack Migration (Required First)

The current app uses `output: "export"` (static export). To unlock dynamic OG images, share URLs, and route-level metadata, **migrate to standard Next.js on Vercel**:

- Remove `output: "export"` from `next.config.mjs`.
- Keep `images.unoptimized: false` (drop the line — default is optimized).
- Confirm the app still deploys to Vercel as a normal Next.js project (no `out/` directory needed; Vercel builds `.next/`).
- All existing routes must still render server-side or as client components — preserve "use client" boundaries.
- Verify on local `npm run dev` and `npm run build` (no `next export` invocation).

**Success criteria for migration:**
- [ ] `next.config.mjs` has no `output: "export"`.
- [ ] `npm run build` produces `.next/` without errors.
- [ ] The home page still renders the BurnRate app exactly as before.
- [ ] All existing tests (`src/lib/burnrate.test.ts`, `src/components/BurnRateApp.test.tsx`, `src/components/BurnRateApp.extra.test.tsx`, `src/hooks/useLocalStorage.test.ts`, `src/lib/burnrate.edge.test.ts`) still pass.
- [ ] No 500s or hydration warnings in the browser console on home page load.
- [ ] A `vercel.json` (or `vercel.ts` if you prefer the newer config) sets framework `nextjs` and no special build command is required.

---

# Feature 1 — ICS Calendar Export for Renewals & Trials

**Goal:** Let the user download a single `.ics` file that imports every upcoming renewal and trial-end into Google Calendar, Apple Calendar, Outlook, etc.

## Implementation

- Add a new function `serializeBurnRateIcs(data: BurnRateData, options?: { horizonDays?: number }): string` in `src/lib/burnrate.ts` (or a new `src/lib/ics.ts`).
- For each subscription, emit `VEVENT`s for the next N renewals based on `billingCycle` from `nextBillingDate` forward, defaulting to a 12-month horizon.
- For each trial, emit one `VEVENT` for `trialEndDate`.
- Use the iCalendar RFC 5545 format. Required properties: `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//BurnRate//EN`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, then one or more `VEVENT` blocks with `UID`, `DTSTAMP`, `DTSTART;VALUE=DATE`, `SUMMARY`, `DESCRIPTION`, `CATEGORIES`, and `END:VEVENT`.
- Use UTC `DTSTAMP` and all-day `DTSTART;VALUE=DATE` (YYYYMMDD).
- Wrap lines longer than 75 octets per RFC 5545 §3.1 (continuation lines start with a single space).
- `UID` format: `<recordId>-<isoDate>@burnrate.app` so re-imports update rather than duplicate.
- `SUMMARY` examples: `Netflix renews — $15.99`, `Notion trial ends — becomes $10.00/mo`.
- Add a 1-day-prior `VALARM` block (`ACTION:DISPLAY`, `TRIGGER:-P1D`) on every event.
- Wire a "Download .ics" button in the **Share & Data** tab next to the existing CSV/PNG buttons. Filename: `burnrate-calendar-<today>.ics`. MIME type: `text/calendar;charset=utf-8`.
- Include a sub-heading and one-line copy explaining what it does.

## Success Criteria
- [ ] `serializeBurnRateIcs` is exported and unit-tested in `src/lib/burnrate.ics.test.ts`.
- [ ] Tests cover: empty input, single weekly sub, single monthly sub, single quarterly sub, single yearly sub, single trial, mixed bag, and 12-month horizon expansion.
- [ ] Output validated against ICS structure — at minimum: starts with `BEGIN:VCALENDAR`, ends with `END:VCALENDAR`, contains `VERSION:2.0`, has at least one `VEVENT` when data is present, line-folding is correct.
- [ ] A real `.ics` produced by the app imports cleanly into Google Calendar (manually verified — note in commit message: "verified Google Calendar import on YYYY-MM-DD") OR an automated parser test using the generated text proves structural validity.
- [ ] Download button is keyboard-accessible (`button` element with `type="button"`), shows the same toast pattern as the CSV download, and works on mobile.
- [ ] No additional runtime dependency added (pure string assembly).

---

# Feature 2 — Popular Services Quick-Picker

**Goal:** Eliminate empty-state friction. New users can add the 30 most common subscriptions in one click each, with pre-filled name, category, color, icon, and a sensible default cost they can edit before saving.

## Implementation

- Create `src/data/popular-services.ts` exporting `popularServices: PopularService[]` where:
  ```ts
  interface PopularService {
    name: string;             // "Netflix"
    domain: string;           // "netflix.com"  (used for logo lookup, see below)
    category: string;         // must match defaultCategories
    defaultCents: number;     // representative US price in cents (Standard tier when applicable)
    defaultBillingCycle: BillingCycle;
    color: string;            // brand-ish hex, falls back to category color
    icon: string;             // lucide-react icon name
    cancelUrl?: string;       // direct deep-link to cancellation page if known
  }
  ```
- Include at minimum these 30: Netflix, Spotify, Hulu, Disney+, Max (formerly HBO Max), Apple TV+, Apple Music, YouTube Premium, YouTube TV, Amazon Prime, Paramount+, Peacock, Audible, Kindle Unlimited, Dropbox, Google One, iCloud+, OneDrive, Notion, Figma (Pro), Canva Pro, Adobe Creative Cloud, GitHub Pro, ChatGPT Plus, Claude Pro, Grammarly, 1Password, NordVPN, Peloton, DoorDash DashPass.
- Build a new component `src/components/PopularServicesPicker.tsx`:
  - A responsive grid of clickable tiles (icon + name + category + suggested price).
  - Search/filter input at top.
  - Clicking a tile opens an inline mini-form prefilled with that service's defaults; user adjusts cost and billing date, then confirms — which appends a new `Subscription` via the parent's `addSubscription`-equivalent callback.
  - Already-added services (matched by case-insensitive name) appear visually disabled with a "Added" badge.
- Surface the picker in two places:
  1. **Empty state** on the dashboard — when `subscriptions.length === 0`, show "Add from popular services" CTA that opens the picker as a section or modal.
  2. **Subscriptions view** — a button "Add from popular services" alongside the existing "Quick add" button.
- Logo display: try `https://logo.clearbit.com/<domain>` lazily as `<img>` with `onError` fallback to the lucide icon. (Clearbit's logo endpoint is free, public, no API key; if you'd rather not depend on it, omit logos and use icons.) Add `referrerPolicy="no-referrer"` and `loading="lazy"`.

## Success Criteria
- [ ] `popularServices` exports exactly 30+ entries; each entry passes a runtime sanity check (positive `defaultCents`, valid `billingCycle`, category in `defaultCategories`).
- [ ] Unit test `src/data/popular-services.test.ts` asserts the array length ≥ 30, no duplicate names, every category is one of `defaultCategories`.
- [ ] Picker renders, filters by search query (case-insensitive on name+category), and adds the chosen service to the subscriptions list with one click + one confirm.
- [ ] Component test `src/components/PopularServicesPicker.test.tsx` covers: rendering, filtering, "already added" disabled state, click-to-add flow, keyboard navigation (Tab, Enter activates a tile).
- [ ] Empty-state dashboard shows the picker entry-point. After adding one service, the picker entry-point still exists but normal dashboard content appears.
- [ ] Picker is keyboard-accessible, screen-reader friendly (`role="listbox"` or proper button semantics), and works at 375px width.
- [ ] No layout shift > 0.1 CLS when logos load (use `width`/`height` attributes or aspect-ratio CSS).

---

# Feature 3 — Installable PWA (Progressive Web App)

**Goal:** Users can install BurnRate to their phone or desktop home screen and open it as a standalone app. Offline access works for everything except the optional logo fetches.

## Implementation

- Create `public/manifest.webmanifest`:
  - `name`: "BurnRate — Subscription Tracker"
  - `short_name`: "BurnRate"
  - `start_url`: "/"
  - `scope`: "/"
  - `display`: "standalone"
  - `background_color`: "#0f1115"
  - `theme_color`: "#0f1115"
  - `description`: existing description from metadata
  - `categories`: ["finance", "productivity", "utilities"]
  - `icons`: at minimum 192x192, 512x512, and a 512x512 maskable variant — generate them by reusing the flame logo / existing apple-touch-icon as a source.
- Reference the manifest in `src/app/layout.tsx` via the Next metadata API (`manifest: "/manifest.webmanifest"`).
- Add a service worker. Use one of these two approaches (pick the simpler one):
  1. **Hand-rolled SW** at `public/sw.js` with cache-first for static assets and stale-while-revalidate for HTML. Register it from a small client-only component in `src/components/ServiceWorkerRegistrar.tsx`.
  2. **`@serwist/next`** or **`next-pwa`** — only add if a hand-rolled SW becomes painful; prefer no dependency.
- The service worker must:
  - Precache the app shell on `install`.
  - Serve a cached app shell on offline navigations to `/`.
  - Skip caching for opaque cross-origin responses.
  - Bump cache version with a constant (`CACHE_VERSION`) so a deploy invalidates stale caches.
- Add an "Install BurnRate" button in the header (or in a small banner) that listens for the `beforeinstallprompt` event, captures it, and shows the prompt when clicked. Hide the button if the app is already installed (`window.matchMedia('(display-mode: standalone)').matches`) or if the event never fires.
- Generate icon assets and check them into `public/icons/`. Filenames: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`. (Use the existing puppeteer setup or `sharp` from devDependencies to produce them programmatically in a build-time script if it makes sense; otherwise commit pre-rendered images.)

## Success Criteria
- [ ] `manifest.webmanifest` is reachable at `/manifest.webmanifest` and validates against [the W3C manifest spec](https://w3c.github.io/manifest/) — at minimum, all required fields present.
- [ ] Lighthouse PWA audit (run via `npx lighthouse http://localhost:3000 --only-categories=pwa`) scores ≥ 90, or every available PWA check passes.
- [ ] Service worker is registered on first load and serves a cached shell when offline. Verified by toggling DevTools "Offline" and refreshing — the dashboard still renders, totals still computed.
- [ ] Install button appears in supported browsers (Chromium-based desktop + Android Chrome) and is hidden otherwise.
- [ ] After install, opening the installed app launches in standalone mode (no browser chrome).
- [ ] No console errors related to SW or manifest.
- [ ] `npm run build` still passes; the SW file is emitted to `out/` or `.next/`-equivalent in a way that production serves it.

---

# Feature 4 — URL-Encoded Cross-Device Sync

**Goal:** A user can copy a long "sync link" on Device A, open it on Device B, and have all their data restored. No server, no account.

## Implementation

- Add `src/lib/sync.ts` with:
  ```ts
  export function encodeSyncPayload(data: BurnRateData): string;   // returns base64url-encoded LZ-string
  export function decodeSyncPayload(input: string): BurnRateData;  // throws on tamper / corruption
  ```
- Use `lz-string` for compression (install via `socket npm install lz-string@^1` — ~5KB minified, MIT). Or implement minimal RLE if you prefer no dependency, but lz-string is preferred for ratio.
- Wrap the compressed payload with a tiny header: `BR1.` prefix + payload, so future schema versions can branch.
- Encoded payload is appended as a URL fragment (`#sync=BR1...`) — fragments aren't sent to servers, which is privacy-friendly.
- On app load, if `location.hash` starts with `#sync=`, prompt the user with a modal: "Found a BurnRate sync payload. Merge into your data, replace your data, or cancel?" Show the counts ("23 subscriptions, 2 trials") in the modal.
  - **Merge** — combine by name (case-insensitive); existing wins on conflict, new ones appended.
  - **Replace** — overwrite everything (with a second confirm).
  - **Cancel** — clear the hash, do nothing.
- After applying, strip the `#sync=...` fragment via `history.replaceState`.
- Add a "Generate sync link" button in the **Share & Data** tab that:
  - Copies the full URL (`https://yourdomain/#sync=...`) to the clipboard.
  - Warns above the button: "Anyone with this link can see your data. Don't share publicly."
  - Shows a tooltip with the byte size and a hint if the payload is over ~30KB (URL length limits on some platforms).
- Provide a fallback: if the payload is too large for clipboard / URL, offer to save as a `.burn` file (just the encoded payload) which the user can then drop into the app on Device B (a hidden file input).

## Success Criteria
- [ ] Round-trip property test in `src/lib/sync.test.ts`: arbitrary `BurnRateData` → encode → decode → deep-equals original. Run on ≥ 20 random fixtures including unicode names, large costs, multiple billing cycles.
- [ ] Tampering test: flipping a byte in the encoded payload causes `decodeSyncPayload` to throw (don't just silently corrupt).
- [ ] Schema-version test: payloads with unknown prefix (e.g., `BR2.`) throw a descriptive error.
- [ ] Loading a URL with `#sync=...` opens the modal; choosing "Replace" replaces data; choosing "Cancel" leaves data untouched and clears the hash.
- [ ] "Generate sync link" copies to clipboard and shows the toast.
- [ ] No new dependency added beyond `lz-string` (or zero if you implement compression in-house).
- [ ] The privacy warning is visible and styled with the warning tone.

---

# Feature 5 — Budget Targets & Cancellation Goals

**Goal:** Turn BurnRate from a viewer into a behavior-change tool. Users can set a monthly burn ceiling and a cancellation savings goal, and see progress toward both.

## Implementation

- Extend the data model:
  ```ts
  export interface BudgetGoal {
    monthlyCapCents: number | null;          // null = no cap set
    annualSavingsTargetCents: number | null; // null = no target
    targetDate: string | null;               // ISO date (YYYY-MM-DD) for savings target
    baselineYearlyCents: number | null;      // snapshot of yearly burn when goal was set
    createdAt: string | null;
  }
  ```
- Add `budget` to `BurnRateData`. Persist via `useLocalStorage` under key `burnrate.budget.v1`.
- Update `serializeBurnRateCsv` / `parseBurnRateCsv` to round-trip budget data (new `recordType: "budget"` row).
- Add a new dashboard module `BudgetTracker` (or fold into existing dashboard layout):
  - **Monthly cap thermometer** — horizontal progress bar showing `monthlyBurnCents / monthlyCapCents`. Color: green (<70%), amber (70–95%), red (≥95%), pulsing red (>100%).
  - **Cancellation goal card** — shows `(baselineYearlyCents - currentYearlyCents) / annualSavingsTargetCents`, days remaining to `targetDate`, and a progress bar.
  - "Set goal" / "Edit goal" buttons that open inline forms (no modal dependency).
- Generate new insights when budget is set:
  - "Your monthly burn is $X over the $Y cap you set." (tone: danger)
  - "You're 47% to your $Z savings goal — $W to go by [targetDate]."
  - "You've saved $X since [baselineDate]." (positive when current < baseline)
- Add a small Settings section (or fold into Share & Data) for setting/clearing goals.

## Success Criteria
- [ ] `budget` is persisted in localStorage and round-trips through CSV export/import.
- [ ] Thermometer correctly reflects ratio at boundaries (0%, 50%, 100%, 150%).
- [ ] Insights appear in the dashboard insights panel when budget is set; don't appear when null.
- [ ] Unit tests for budget math in `src/lib/burnrate.budget.test.ts`: cap calculation, savings calculation against baseline, days-remaining math.
- [ ] Setting a cap of $0 or negative number is rejected with a friendly inline error.
- [ ] The "Set goal" form is keyboard-accessible and validates inputs.
- [ ] Clearing a goal removes it from localStorage and from the dashboard.
- [ ] CSV-import test confirms a CSV with `recordType=budget` row hydrates the budget correctly.

---

# Feature 6 — Command Palette (Cmd/Ctrl-K)

**Goal:** Power users invoke any action in two keystrokes. New users discover features through searchable commands.

## Implementation

- Add `src/components/CommandPalette.tsx`:
  - Opens on `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux) / `Cmd+P` on iOS Safari (if focusable). Closes on `Esc`, click outside, or selection.
  - Renders as a centered modal with a search input and a virtualized result list (no virtualization library; the list is small — top 50 results max).
  - Trap focus inside the dialog while open. Restore focus on close.
- Define commands inline in a `commands` array. Minimum required commands:
  - `Add subscription` → switches to Subscriptions view, focuses the name field.
  - `Add free trial` → switches to Trials view, focuses the trial name field.
  - `Open dashboard` / `Open subscriptions` / `Open trials` / `Open simulator` / `Open share` (one each).
  - `Toggle dark/light mode`.
  - `Export CSV` / `Export ICS calendar` / `Generate sync link` / `Download share image`.
  - `Reset all data` (with the usual confirm dialog).
  - `Set monthly budget cap` / `Set savings goal`.
  - `Open popular services picker`.
  - Plus a dynamic block: every existing subscription appears as "Edit <name>" and "Delete <name>" commands.
- Fuzzy match commands and subscriptions by name/category. Implement a tiny scorer inline — no `fuse.js`. Match should be case-insensitive substring at minimum; bonus for prefix matches.
- Keyboard: ↑/↓ navigates, Enter executes, Tab cycles, Shift+Enter is reserved for the future.
- A hint at the bottom of the palette: `↑↓ navigate · ↵ select · esc close`.
- Add a tiny "⌘K" indicator in the header that opens the palette on click.

## Success Criteria
- [ ] Pressing `Ctrl+K` / `Cmd+K` opens the palette from anywhere in the app (except inside `<input>` / `<textarea>` where the browser's own behavior should win — but the palette should still open if focus is on a non-text element).
- [ ] Test file `src/components/CommandPalette.test.tsx` covers: opens on hotkey, closes on Esc, filters by query, executes selected command, focuses original element on close.
- [ ] All listed commands are present and functional.
- [ ] Per-subscription edit/delete commands appear and work for the currently-stored subscriptions.
- [ ] Focus is trapped while open; screen readers announce "Command palette" via `aria-label`.
- [ ] Visible focus ring on the active result.
- [ ] No layout shift when opening/closing.

---

# Feature 7 — Vercel-Powered Share URLs with Dynamic OG Images

**Goal:** Users can generate a read-only public link to their burn summary. The link renders an attractive page with a dynamic Open Graph image that shows their actual numbers — perfect for social shares.

> Depends on the migration off `output: "export"`. Do that first.

## Implementation

- New route: `src/app/s/[payload]/page.tsx` where `[payload]` is the same lz-string base64url-encoded `BurnRateData` (or a stripped subset — see below).
- The page is a **read-only** view: monthly burn, yearly burn, category donut, top 5 subscriptions by cost. **Never** show notes (potential PII) — strip notes from the encoded payload before sharing.
- Add a "Create public share link" button in **Share & Data** that:
  - Strips notes from a clone of the data.
  - Encodes via the same `encodeSyncPayload` from Feature 4 (or a parallel `encodeSharePayload` if the schema differs).
  - Builds `https://<origin>/s/<payload>`.
  - Copies to clipboard.
  - Warns: "This link is public. Anyone with it can see your subscriptions and totals (notes are removed)."
- New route: `src/app/s/[payload]/opengraph-image.tsx` using Next.js's built-in `ImageResponse` (free, no external service):
  - 1200×630.
  - Renders the brand mark + the user's monthly burn number + top 3 categories.
  - Reuses the same display font (Bebas Neue) via the font-loader pattern.
- Add the dynamic OG image as the `openGraph.images` for the `/s/[payload]` page (per-route metadata).
- Add a `noindex` `<meta>` to the share page so Google doesn't index random shares.
- Stretch: also produce a `twitter-image.tsx` mirroring the OG image.

## Success Criteria
- [ ] Visiting `/s/<valid-payload>` renders the read-only summary without errors.
- [ ] Visiting `/s/<garbage-payload>` shows a graceful "This share link is invalid or expired" page (HTTP 200 with a friendly message; do not 500).
- [ ] `/s/<payload>/opengraph-image` returns a PNG with `Content-Type: image/png` and dimensions 1200×630.
- [ ] LinkedIn / Twitter / Facebook preview tools (manually verified, note in commit) show the dynamic OG image with the user's numbers.
- [ ] The share page contains `<meta name="robots" content="noindex" />`.
- [ ] No subscription `notes` field appears anywhere in the rendered HTML or in the encoded payload.
- [ ] The link round-trips: encode on the app, decode on the share route, render the same totals.
- [ ] Test in `src/app/s/share-page.test.tsx` (or a colocated test) verifies the read-only data hydration logic with a known fixture.
- [ ] The OG image route is excluded from the SW cache (or cached with a short TTL) so it stays current.

---

# Cross-Feature Polish (also required)

- **Settings consolidation.** As features land, the **Share & Data** tab is going to get crowded. Rename it to **Settings & Data** and group buttons into clear sections: *Backup* (CSV, ICS, .burn), *Sync* (sync link), *Share* (public share link, PNG), *Goals* (budget, savings), *Danger zone* (reset all data).
- **Toast queue.** The current single-toast pattern overwrites quickly. Convert to a queue of up to 3 visible toasts stacking vertically. Existing call sites should keep working.
- **Skip-link.** Already present — verify it still works after the new sections are added.
- **No prop-drilling explosion.** If `BurnRateApp.tsx` grows beyond ~700 lines, extract a `useBurnRateState` hook that returns the state slices and mutators. Keep components dumb where you can.

## Cross-Feature Success Criteria
- [ ] `BurnRateApp.tsx` either stays under ~700 lines or has the state extracted into a hook.
- [ ] All toasts use the queue; concurrent operations show multiple toasts that auto-dismiss in order.
- [ ] Settings & Data tab has the four labeled sections above.
- [ ] No console warnings on first load.

---

# Required Documentation Updates

- Update `README.md` (or create one) with:
  - Updated feature list.
  - How to install as a PWA.
  - How sync links and share links differ (sync = full restore, share = read-only public).
  - Privacy statement: data lives in your browser; sync/share links contain your data.
- Update or replace `docs/goal.md` reference to point to this `goal2.md`.
- Add `docs/architecture.md` summarizing the runtime data flow (≤ 1 page).

---

# Final Verification Checklist

Before declaring the milestone complete, run every step below and confirm green. **Do not stop until every box can be checked.**

1. [ ] `npm run typecheck` → 0 errors.
2. [ ] `npm test` → all tests pass.
3. [ ] `npm run build` → exits 0, produces a working `.next/` output.
4. [ ] `npm run dev` and manually walk through:
   - [ ] Dashboard renders with empty state and offers the Popular Services picker.
   - [ ] Add 3 services via the picker — totals update.
   - [ ] Edit one inline — change reflects on dashboard.
   - [ ] Open command palette with `Ctrl+K`, type "trial", press Enter to jump to Trials.
   - [ ] Add a trial expiring in 2 days — urgent state shows; in-app alert banner shows.
   - [ ] Set a $50 monthly cap — thermometer shows red because total exceeds it.
   - [ ] Set a $200 annual savings goal — goal card shows progress.
   - [ ] Toggle simulator — see savings; the savings goal progress updates as if you canceled them.
   - [ ] Export ICS, open it in a calendar app or validate it with an online iCal validator.
   - [ ] Generate a sync link, paste into a different browser profile, choose Replace — all data appears.
   - [ ] Generate a public share link, open `/s/<payload>` in an incognito window — see read-only summary, no notes leak.
   - [ ] View OG image at `/s/<payload>/opengraph-image` — looks correct.
   - [ ] Install as PWA on desktop Chrome; relaunch from the OS app launcher.
   - [ ] Toggle DevTools Offline → refresh → app still renders.
   - [ ] 375px viewport — every new screen and modal is usable.
   - [ ] Light mode and dark mode both look correct on every new surface.
5. [ ] Lighthouse on `localhost:3000`: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95, PWA ≥ 90.
6. [ ] Vercel preview deploy succeeds; the deployed URL works end-to-end.
7. [ ] No new third-party scripts loaded at runtime beyond optional Clearbit logo images.
8. [ ] Bundle size delta logged in the commit message — keep additional JS shipped to the home page under 60KB gzipped.
9. [ ] `socket scan` (if a token is available) reports 0 high-severity issues. Otherwise note "no token, skipped — manual review done."
10. [ ] Every feature's individual success-criteria list above is fully checked.

# Progress Log Requirement

Maintain a running progress log in `docs/v2-progress.md` with one section per feature: "Started", "Decisions", "Tests added", "Verified". Update it after each major commit. This is the artifact a human reviewer will read.

# Stopping Condition

**Stop only when every check above is green and the progress log shows every feature `Verified`.** If you hit an obstacle, document it in the progress log, attempt a workaround, and only escalate to a human if the workaround would violate a hard constraint above.
