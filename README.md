# BurnRate

BurnRate is a free, local-first subscription tracker and spending analyzer. It helps track recurring subscriptions, free trials, upcoming renewals, category spend, cancellation savings, and budget goals — all without a backend, account, database, or API key.

## Features

### Dashboard & tracking
- Monthly and yearly burn-rate dashboard
- Category breakdown chart and upcoming renewal timeline
- Inline subscription add/edit/delete workflow
- Free trial countdowns with urgency indicators and browser notifications
- Rule-based smart insights
- What-if cancellation simulator

### Add things fast
- Popular Services quick-picker (30+ pre-filled common subscriptions)
- Command palette via `Cmd+K` / `Ctrl+K` (or the `⌘K` header button)

### Goals
- Monthly budget cap with thermometer (green / amber / red / over)
- Annual cancellation savings goal with progress card and target date

### Backup, sync, and share
- CSV export and import (round-trips subscriptions, trials, budget, and theme)
- ICS calendar export — drop renewals and trial-end dates into Google / Apple / Outlook
- `.burn` file backup
- **Sync link** — a `#sync=...` URL that round-trips your full state across devices (full restore)
- **Public share link** — a `/s/<payload>` URL with a dynamic OG image showing your monthly burn (read-only, notes stripped)
- Shareable summary card with PNG download

### PWA
- Installable on phone or desktop — works offline once visited
- App-shell cached by a service worker; install button appears when supported

### A11y & UX
- Skip-to-content link
- Keyboard-driven command palette
- Mobile-first responsive layout (375px and up)
- Dark and light themes

## Tech Stack

- Next.js 16 (App Router) on Vercel (no static export)
- TypeScript (strict)
- Tailwind CSS
- Recharts
- html2canvas (PNG share card)
- `lz-string` (URL-encoded sync payloads)
- Browser `localStorage` + service worker cache

## Development

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000`.

To regenerate PWA icons after editing the source SVG:

```bash
node scripts/generate-pwa-icons.mjs
```

## Verification

```bash
npm test         # vitest, ~190 tests
npm run typecheck
npm run build
```

## Installing as a PWA

1. Visit BurnRate in a Chromium-based browser (desktop Chrome / Edge, Android Chrome) or a modern Safari.
2. Look for the **Install** button in the header (visible when `beforeinstallprompt` fires) or use the browser's "Install app" menu.
3. Once installed, BurnRate runs in standalone mode and works offline.

## Sync link vs. share link

- **Sync link** (`/#sync=...`): full data restore including subscriptions, trials, and budget. Anyone with the URL can see your data — don't share it. The destination prompts you to **Merge**, **Replace**, or **Cancel**.
- **Public share link** (`/s/<payload>`): read-only summary page. Notes are stripped before encoding. The page is `noindex`. The OG image is generated dynamically at `/s/<payload>/opengraph-image`.

## Privacy

BurnRate stores all data in your browser's `localStorage`. There is no server-side storage, account, telemetry, or paid API.

When you generate a sync or share link, the entire payload is encoded into the URL fragment (sync) or path (share). URL fragments are not sent to the server. Path segments for share links ARE sent to the server when the link is opened — the server only uses the payload to render the read-only page and returns the OG image.
