# BurnRate Progress Log  [v1 COMPLETED — 2026-05-12]

> **This log covers `docs/goal.md` (v1), which is complete.**
> The active goal is `docs/goal2.md`. Its progress log lives in `docs/v2-progress.md` (v2 also complete as of 2026-05-12).
> Kept here for historical reference only.

## v1 milestones (shipped)

- Read `docs/goal.md` and implemented a static Next.js App Router project with `output: "export"`.
- Added Socket-managed dependencies for Next.js, React, Tailwind CSS, Recharts, html2canvas, lucide icons, Vitest, and DOM testing.
- Built the tested BurnRate domain layer: cents-based money helpers, billing-cycle normalization, renewals, insights, trial status, simulator impact, and CSV import/export.
- Built the client app UI: dashboard, subscription manager, free trial tracker, smart insights, what-if simulator, shareable PNG summary card, CSV import/export, reset flow, localStorage persistence, and dark/light theme toggle.
- Added automated tests for calculation logic and core user flows.
- Verified `npm run test`, `npm run typecheck`, and `npm run build` complete successfully.

## Post-v1 additions (also shipped, pre-v2)

- Free-trial in-app banner + browser `Notification` permission flow + on-load alerting (`TrialAlerts` component, `getPendingTrialAlerts` logic, `TRIAL_ALERT_THRESHOLDS` of 1/3/7 days).
- Open Graph image hardening: switched to Puppeteer-rendered `og-v4.png` at 4× supersample + lanczos3 downsample for sharp social previews.
- Tailwind 4.x PostCSS plugin incompat investigated; rolled back to Tailwind 3.4.19 to unblock production build.
- Rebased local refactor on top of Dependabot security updates.
