import { expect, test } from "./harness/trizum.fixture";

test.use({ hasTouch: true });

const gestures = [
  { name: "tiny fast nudge", horizontal: 8, vertical: 8, duration: 10, dismisses: false },
  { name: "short slow drag", horizontal: 60, vertical: 30, duration: 1000, dismisses: false },
  { name: "deliberate slow drag", horizontal: 160, vertical: 50, duration: 1000, dismisses: true },
  { name: "clear flick", horizontal: 60, vertical: 20, duration: 20, dismisses: true },
];

for (const direction of ["left", "right", "bottom"] as const) {
  for (const gesture of gestures) {
    test(`${direction}: ${gesture.name} ${gesture.dismisses ? "dismisses" : "snaps back"}`, async ({
      page,
      browserName,
    }) => {
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
      const y = direction === "bottom" ? box.y + 6 : box.y + box.height / 2;

      const dx =
        direction === "left" ? -gesture.horizontal : direction === "right" ? gesture.horizontal : 0;

      const dy = direction === "bottom" ? gesture.vertical : 0;
      const start = Date.now();
      // Sonner measures average velocity with Date; control it without freezing animation frames.
      await page.clock.setFixedTime(start);

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

        await expect(toast).toHaveAttribute("data-swiped", "true");
        await page.clock.setFixedTime(start + gesture.duration);
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await session.detach();
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 6 });
        await expect(toast).toHaveAttribute("data-swiped", "true");
        await page.clock.setFixedTime(start + gesture.duration);
        await page.mouse.up();
      }

      if (gesture.dismisses) {
        await expect(toast).toHaveAttribute("data-swipe-out", "true", { timeout: 1000 });
        await expect(toast).toHaveCount(0);
      } else {
        await expect(toast).toHaveAttribute("data-swiping", "false");
        await expect(toast).toHaveAttribute("data-removed", "false");
        await expect(toast).toHaveCSS("--swipe-amount-x", "0px");
        await expect(toast).toHaveCSS("--swipe-amount-y", "0px");
      }
    });
  }
}
