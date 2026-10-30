import { expect, test } from "./harness/trizum.fixture";
import { createPartyFixture, defaultParticipants } from "./harness/scenarios";

test.use({ serviceWorkers: "allow" });
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Playwright service-worker integration is supported on Chromium.",
);

test("a real service worker preserves a synthetic party across offline reload and navigation", async ({
  harness,
  page,
  context,
}, testInfo) => {
  const fixture = createPartyFixture();
  const { partyId } = await harness.seedJoinedParty({
    fixture,
    memberParticipantId: defaultParticipants.blair.id,
  });
  await harness.goto(`/party/${partyId}`);
  await expect(page.getByRole("heading", { name: fixture.party.name })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
    )
    .toBe("activated");
  const registration = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      script: registration.active?.scriptURL,
      state: registration.active?.state,
      caches: await caches.keys(),
    };
  });
  expect(registration.state).toBe("activated");
  expect(registration.script).toMatch(/\/sw\.js$/);
  expect(registration.caches.length).toBeGreaterThan(0);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  try {
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: fixture.party.name })).toBeVisible();
    await harness.goto(`/party/${partyId}?tab=balances`);
    await expect(page.getByRole("heading", { name: fixture.party.name })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("offline-controlled-party.png") });
    await testInfo.attach("service-worker-registration", {
      body: JSON.stringify(registration, null, 2),
      contentType: "application/json",
    });
  } finally {
    await context.setOffline(false);
  }
});
