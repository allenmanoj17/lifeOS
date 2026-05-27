import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/trackdaily",
  "/trackdaily/plan",
  "/trackdaily/calendar",
  "/trackdaily/analytics",
  "/trackdaily/review",
  "/trackdaily/settings",
];

test.describe("route smoke", () => {
  for (const route of routes) {
    test(`${route} renders without a server error`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("body")).toContainText(/Epta LifeOS|Configuration Required|Sign in/i);
      await expect(page).toHaveScreenshot(`${route.replaceAll("/", "_") || "home"}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.08,
      });
    });
  }
});

