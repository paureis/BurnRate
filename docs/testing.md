# Testing

BurnRate uses two test suites that run independently:

## Unit tests (Vitest)

The default test runner. Targets pure modules in `src/lib/*` and component logic in `src/components/*`. Runs in jsdom for component tests; pure-module tests run in plain Node.

```bash
npm test            # one-shot
npx vitest          # watch
npx vitest run src/lib/currency.test.ts   # one file
```

A failed `console.error` / `console.warn` fails the test — silent regressions get caught.

As of v3 the suite contains 290+ tests covering: FX math, charges parser, charge matcher, ledger math, snapshot capture & retention, recommendations (bundle/overlap detection), crypto round-trip, sync v1/v2 decode, plus all v1+v2 component and library behaviour.

## E2E smoke (Playwright)

Lives in `tests/e2e/`. Not required for CI in v3 — local-only. Run against a dev server:

```bash
# in one terminal
npm run dev

# in another
npm run e2e        # headless
npm run e2e:ui     # Playwright UI
```

The smoke specs cover only the most user-visible paths:

- `dashboard.spec.ts` — boot, hero metrics, command palette open.

Add new specs in `tests/e2e/` and they auto-discover.
