import { createPartyFixture } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

const campaign = "entry=ai&utm_source=mcp&utm_medium=ai_app&utm_campaign=party_handoff";

test("AI invite offers stores and continues through the existing party join flow", async ({
  harness,
  page,
}) => {
  const seeded = await harness.seedJoinableParty(createPartyFixture());
  await harness.goto(`${seeded.joinUrl}?${campaign}`);
  await expect(page.getByRole("heading", { name: "Your group is ready" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeHidden();
  await expect(page.getByRole("figure", { name: "Invite QR code" })).toBeVisible();
  const apple = page.getByRole("link", { name: "Download on the App Store" });
  const google = page.getByRole("link", { name: "Get it on Google Play" });
  await expect(apple).toHaveAttribute("href", "https://apps.apple.com/app/trizum/id6755971747");
  await expect(google).toHaveAttribute(
    "href",
    "https://play.google.com/store/apps/details?id=app.trizum.capacitor",
  );
  await expect(google).toHaveAttribute("referrerpolicy", "no-referrer");
  expect((await harness.readPartyList()).parties[seeded.partyId]).not.toBe(true);

  const installedLink = page.getByRole("link", { name: "Already have trizum? Open your group" });
  const href = await installedLink.getAttribute("href");
  expect(href).toContain(`/party/${seeded.partyId}?utm_source=mcp`);
  expect(href).not.toContain("entry=");

  await page.getByRole("button", { name: "Continue on the web", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await harness.selectParticipantIdentity("Alex");
  await expect(page).toHaveURL(new RegExp(`/party/${seeded.partyId}\\?tab=expenses$`));
  expect((await harness.readPartyList()).parties[seeded.partyId]).toBe(true);
  await expect(page.getByRole("heading", { name: "Your group is ready" })).toBeHidden();
});

test.describe("Android acquisition", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    viewport: { width: 390, height: 844 },
  });
  test("prioritizes Google Play while retaining web access", async ({ harness, page }) => {
    const seeded = await harness.seedJoinableParty(createPartyFixture());
    await harness.goto(`${seeded.joinUrl}?${campaign}`);
    await expect(page.getByRole("link", { name: "Get it on Google Play" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download on the App Store" })).toHaveCount(0);
    await expect(page.getByRole("figure", { name: "Invite QR code" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue on the web", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});

test.describe("iOS acquisition", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  test("prioritizes the App Store while retaining web access", async ({ harness, page }) => {
    const seeded = await harness.seedJoinableParty(createPartyFixture());
    await harness.goto(`${seeded.joinUrl}?${campaign}`);
    await expect(page.getByRole("link", { name: "Download on the App Store" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get it on Google Play" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Continue on the web", exact: true }),
    ).toBeVisible();
  });
});

test("campaign labels alone leave the ordinary invite flow intact", async ({ harness, page }) => {
  const seeded = await harness.seedJoinableParty(createPartyFixture());
  await harness.goto(`${seeded.joinUrl}?${campaign.replace("entry=ai&", "")}`);
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your group is ready" })).toBeHidden();
});
