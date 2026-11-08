import { createImbalancedPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test("keeps moving with resistance beyond the refresh threshold and cancels cleanly", async ({
  harness,
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const seededParty = await harness.seedJoinedParty({
    fixture: createImbalancedPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });

  await harness.navigate(`/party/${seededParty.partyId}?tab=balances`);
  const panel = page.getByRole("tabpanel", { name: "Balances" });
  await expect(panel).toBeVisible();
  const indicator = panel.locator('div[aria-hidden="true"]').first();
  await expect(indicator).toHaveCount(1);
  const root = indicator.locator("..");

  async function touch(type: string, y: number) {
    await root.dispatchEvent(type, {
      touches: type === "touchcancel" ? [] : [{ identifier: 1, clientX: 100, clientY: y }],
      changedTouches: [{ identifier: 1, clientX: 100, clientY: y }],
    });
  }

  await touch("touchstart", 100);
  await touch("touchmove", 500);
  await expect
    .poll(() => indicator.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThan(96);
  const firstHeight = await indicator.evaluate((element) => element.getBoundingClientRect().height);
  await touch("touchmove", 800);
  await expect
    .poll(() => indicator.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThan(firstHeight + 5);

  const secondHeight = await indicator.evaluate(
    (element) => element.getBoundingClientRect().height,
  );

  expect(secondHeight - firstHeight).toBeLessThan(300 * 0.55);
  await touch("touchcancel", 800);
  await expect
    .poll(() => indicator.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(0);
});
