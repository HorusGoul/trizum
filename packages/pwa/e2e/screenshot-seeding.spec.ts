import { seedScreenshotParty } from "../../screenshots/src/seedParty.ts";
import { expect, test } from "./harness/trizum.fixture";

test.use({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});

test("persists seeded screenshot balances before reloading into the party", async ({
  harness,
  page,
}) => {
  await page.clock.install({ time: new Date("2025-03-12T12:00:00.000Z") });
  await harness.gotoHome();
  const partyId = await seedScreenshotParty(page, "en");

  await harness.goto(`/party/${partyId}/who`);
  await page.getByRole("radio", { name: "Modest" }).click({ force: true });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("tab", { name: "Balances", exact: true }).click();

  await expect(page.getByRole("heading", { name: "How should I balance?" })).toBeVisible();
});
