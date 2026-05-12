# BurnRate — Codex /goal Prompt  [COMPLETED — 2026-05-12]

> **DO NOT USE THIS FILE.** All milestones below were implemented and shipped.
> The current active goal lives in `docs/goal2.md`. Paste that one after `/goal`.
>
> Kept for historical reference only.

---

Build a complete, production-ready web application called **BurnRate** — a free subscription tracker and spending analyzer. The app helps users see exactly how much money they burn on recurring subscriptions, track free trials before they auto-charge, and get smart insights about their spending patterns.

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with static export (`output: 'export'` in next.config) for free Vercel hosting
- **Styling**: Tailwind CSS with a bold, polished design — NOT generic AI aesthetics. Pick a distinctive color palette (dark theme preferred, with a strong accent color like amber, coral, or electric green for the "burn" metaphor). Use a memorable display font from Google Fonts paired with a clean body font.
- **Charts**: Recharts for all data visualizations
- **Storage**: Browser localStorage only — NO backend, NO database, NO authentication, NO API keys
- **Deployment**: Must work as a Vercel static deployment with zero server-side requirements

## Core Features

### 1. Dashboard (Home Page)
- Monthly burn rate (total cost normalized to monthly)
- Yearly burn rate
- Category breakdown pie/donut chart (entertainment, productivity, fitness, music, cloud/storage, news/media, gaming, food delivery, other)
- Upcoming renewals in the next 7 and 30 days, shown as a timeline or sorted list
- Quick-add button to add a new subscription
- A clear, prominent display of the total monthly burn — this is the hero number

### 2. Subscription Manager
- Add, edit, and delete subscriptions
- Each subscription captures: service name, cost, billing cycle (weekly, monthly, quarterly, yearly), category (from predefined list + custom), next billing date, optional notes, and an optional color/icon
- Inline editing — no separate edit page, keep it fast
- Sort by cost, name, next billing date, or category
- Filter by category
- Visual indicator for subscriptions billing within the next 7 days

### 3. Free Trial Tracker
- Separate section or tab for tracking free trials
- Each trial captures: service name, trial start date, trial end date, cost after trial ends, and a "remind me" flag
- Countdown display showing days remaining on each trial
- Visual urgency: trials expiring within 3 days should look alarming (red, pulsing, etc.)
- Easy "convert to subscription" action when a trial ends and user decides to keep it

### 4. Smart Insights Panel
- Auto-generated insights based on the user's data using conditional logic (NOT AI-powered). Examples:
  - "You spend X% of your subscription budget on entertainment"
  - "You have N yearly subscriptions locking in $X per year"
  - "3 subscriptions renew this week totaling $X"
  - "Your most expensive category is [category] at $X/month"
  - "You've added N new subscriptions in the last 30 days"
  - "If you canceled [most expensive subscription], you'd save $X/year"
- Show at least 3 relevant insights on the dashboard at any time
- Insights should update dynamically as data changes

### 5. "What If?" Simulator
- Interactive feature where users can toggle subscriptions on/off to see how their monthly/yearly totals change in real time
- Show a comparison: "Current burn: $X/mo → If you cancel these: $Y/mo — You'd save $Z/year"
- Make it satisfying — use animated number transitions when totals change

### 6. Shareable Summary Card
- A styled, self-contained card that summarizes the user's burn rate and top categories
- Designed to look good as a screenshot for social sharing
- Include a "Copy as Image" or "Download as PNG" button using html2canvas or a similar client-side library
- Include a subtle "Built with BurnRate" watermark for organic marketing

### 7. Data Management
- Export all subscription data as CSV
- Import from CSV (so users don't lose data if they clear their browser)
- A "Reset All Data" option with confirmation dialog

## Design Requirements

- **Dark theme by default** with an optional light mode toggle
- The design should feel premium and intentional — like a fintech app, not a homework project
- Smooth animations and transitions (page transitions, number counting animations, hover states)
- Fully responsive: works beautifully on mobile, tablet, and desktop
- Empty states should be friendly and guide the user to add their first subscription
- Use clear visual hierarchy — the monthly burn total should be the first thing anyone sees
- Micro-interactions: satisfying feedback when adding/deleting subscriptions, toggling the simulator, etc.

## Code Quality

- Clean, well-organized component structure with clear separation of concerns
- Custom hooks for localStorage persistence (useLocalStorage or similar)
- TypeScript throughout — no `any` types
- All monetary calculations should handle floating point correctly (use cents internally or a rounding utility)
- Accessible: proper ARIA labels, keyboard navigation, sufficient color contrast

## Enhancement Freedom

After all core features above are complete and verified, you may add small polish features that improve the user experience — things like keyboard shortcuts, a quick-search/filter bar, animated empty states, or subtle background effects. Use your judgment, but do NOT add: a backend or server, user authentication, any paid API integrations, or any feature that would increase hosting costs beyond $0.

## Verification and Stopping Condition

Run `npm run build` after every major feature addition. The build must pass with zero errors. Verify the app works correctly by confirming:

1. `npm run build` completes with exit code 0 and produces a static export in the `out/` directory
2. All TypeScript compiles with no errors (`npx tsc --noEmit`)
3. The following user flows work without console errors:
   - Adding a subscription with all fields → appears in list and dashboard totals update
   - Editing a subscription → changes reflected everywhere
   - Deleting a subscription → removed from list, totals recalculate
   - Adding a free trial → countdown displays correctly
   - Toggling subscriptions in the What If simulator → totals animate and update
   - Exporting data as CSV → file downloads with correct data
   - Importing data from CSV → subscriptions populate correctly
   - Dark/light mode toggle → all components theme correctly
   - Mobile viewport (375px width) → layout is usable and nothing overflows
4. localStorage persistence works: data survives a page refresh
5. No hardcoded dummy data in the final build — the app starts empty with a friendly onboarding state

**Stop when**: all features above are implemented, the build passes, and the verification checks are satisfied. Keep a short progress log of completed milestones.