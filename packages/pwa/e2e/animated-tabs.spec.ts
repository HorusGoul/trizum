import { createImbalancedPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test.use({
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  isMobile: true,
});

test("activates a tab panel when scrolling settles just before its snap point", async ({
  harness,
  page,
}) => {
  const party = await harness.seedJoinedParty({
    fixture: createImbalancedPartyFixture(),
    memberParticipantId: defaultParticipants.blair.id,
  });
  await harness.gotoParty(party.partyId);

  const horizontalScroller = page.getByRole("tabpanel").locator("..");
  const balancesPanel = horizontalScroller.locator(":scope > div").nth(1);
  await expect(balancesPanel).toHaveAttribute("inert", "");

  const scrollProgress = await horizontalScroller.evaluate((element) => {
    const scroller = element as HTMLDivElement;
    const maximum = scroller.scrollWidth - scroller.clientWidth;

    scroller.style.scrollSnapType = "none";
    scroller.scrollLeft = maximum - 1;
    scroller.dispatchEvent(new Event("scroll"));

    return scroller.scrollLeft / maximum;
  });

  expect(scrollProgress).toBeGreaterThan(0.99);
  expect(scrollProgress).toBeLessThan(1);
  await expect(page.getByRole("tab", { name: "Balances" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(balancesPanel).not.toHaveAttribute("inert", "");
});
