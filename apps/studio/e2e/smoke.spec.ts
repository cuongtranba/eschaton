import { expect, test } from "@playwright/test";

test("studio shell loads and shows the laboratory header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ESCHATON — Laboratory" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Viewport" })).toBeVisible();
});
