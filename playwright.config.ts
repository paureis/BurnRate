import { defineConfig, devices } from "@playwright/test";

// Local-only Playwright smoke suite. Not wired into CI for v3 — see docs/testing.md.
// Run with `npm run e2e` after `npm run dev` is running on http://localhost:3000.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
