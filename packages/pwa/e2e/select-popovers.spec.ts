import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test("select menus keep their size throughout opening", async ({ harness, page }) => {
  await page.setViewportSize({ width: 375, height: 667 });

  const { partyId } = await harness.seedJoinedParty({
    fixture: createPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });

  await harness.navigate(`/party/${partyId}/add`);

  for (const label of ["Currency", "Paid by"]) {
    const trigger = page.getByRole("button", { name: new RegExp(`${label}$`) });
    const triggerBox = await trigger.boundingBox();

    const capture = await page.evaluateHandle(() => {
      const frames: { width: number; height: number }[] = [];
      const started = performance.now();
      let opened: number | undefined;

      const result = new Promise<typeof frames>((resolve) => {
        const sample = () => {
          const popover = document.querySelector('[role="listbox"]')?.closest("[data-placement]");

          if (popover instanceof HTMLElement && Number(getComputedStyle(popover).opacity) > 0) {
            opened ??= performance.now();
            // Measure layout sizes so the intentional scale animation is excluded.
            frames.push({ width: popover.offsetWidth, height: popover.offsetHeight });
          }

          if (performance.now() - (opened ?? started) < (opened == null ? 2000 : 600)) {
            requestAnimationFrame(sample);
          } else {
            resolve(frames);
          }
        };

        requestAnimationFrame(sample);
      });

      return { frames: result };
    });

    await trigger.click();
    const frames = await capture.evaluate((capture) => capture.frames);
    await capture.dispose();
    expect(frames.length).toBeGreaterThan(3);
    const widths = frames.map((frame) => frame.width);
    const heights = frames.map((frame) => frame.height);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(Math.abs(widths[0] - (triggerBox?.width ?? 0))).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
  }
});
