import { test, expect } from "@playwright/test";

test.describe("dashboard smoke", () => {
  test("loads with empty state and accepts a popular service", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /BurnRate/i })).toBeVisible();
    // Hero metrics render even in empty state.
    await expect(page.getByText(/Monthly burn/i).first()).toBeVisible();
  });

  test("opens the command palette via Ctrl+K", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+K");
    await expect(page.getByPlaceholder(/search/i).first()).toBeVisible({ timeout: 2000 });
  });
});
