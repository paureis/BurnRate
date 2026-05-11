# BurnRate

BurnRate is a free, local-first subscription tracker and spending analyzer. It helps track recurring subscriptions, free trials, upcoming renewals, category spend, and cancellation savings without a backend, account, database, or API key.

## Features

- Monthly and yearly burn-rate dashboard
- Category breakdown chart and upcoming renewal timeline
- Inline subscription add/edit/delete workflow
- Free trial countdowns with urgency indicators
- Rule-based smart insights
- What-if cancellation simulator
- Shareable summary card with PNG download
- CSV export/import and reset controls
- Dark and light themes

## Tech Stack

- Next.js App Router with static export
- TypeScript
- Tailwind CSS
- Recharts
- html2canvas
- Browser `localStorage`

## Development

```bash
npm ci
npm run dev
```

Then open `http://localhost:3000`.

## Verification

```bash
npm run test
npx tsc --noEmit
npm run build
```

`npm run build` emits a static export in `out/`.

## Privacy

BurnRate stores all subscription and trial data in the browser's localStorage. There is no server-side storage, authentication, analytics integration, or paid API dependency.
