import { expect, test } from "./harness/trizum.fixture";

test.use({ hasTouch: true });

for (const direction of ["left", "right", "bottom"] as const) {
  test(`dismisses a toast by swiping ${direction}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await page.getByLabel("Username", { exact: true }).fill("Toast tester");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Settings saved" });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveCSS("user-select", "none");
    await expect(toast).toHaveAttribute("data-mounted", "true");
    await toast.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await toast.hover();
    const box = await toast.boundingBox();

    if (!box) throw new Error("Expected a toast");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const dx = direction === "left" ? -100 : direction === "right" ? 100 : 0;
    const dy = direction === "bottom" ? 45 : 0;

    if (browserName === "chromium") {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });

      await expect(toast).toHaveAttribute("data-swiping", "true");

      for (let step = 1; step <= 6; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * step) / 6, y: y + (dy * step) / 6 }],
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
      }

      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 6 });
      await page.mouse.up();
    }

    await expect(toast).toHaveAttribute("data-swipe-out", "true", { timeout: 1000 });
    await expect(toast).toHaveCount(0);
  });
}
