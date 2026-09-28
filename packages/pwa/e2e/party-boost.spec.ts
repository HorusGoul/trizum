import { createPartyFixture, defaultParticipants } from "./harness/scenarios";
import { expect, test } from "./harness/trizum.fixture";

test("a signed-out party member sees a shared boost without a sign-in or activation prompt", async ({
  harness,
  page,
}) => {
  await page.route("**/api/auth/get-session**", (route) => route.fulfill({ json: null }));
  let serverChecks = 0;
  await page.route("**/api/premium/party-boost?**", (route) => {
    serverChecks++;
    return route.fulfill({ status: 401, json: { error: { code: "unauthorized" } } });
  });
  const fixture = createPartyFixture();
  const { partyId } = await harness.joinSeededParty({
    fixture,
    participantName: defaultParticipants.alex.name,
  });
  await harness.setPartyBoost(partyId, {
    "test-boost": {
      boostId: "test-boost",
      participantId: defaultParticipants.blair.id,
      checkedAt: "2026-09-28T10:00:00.000Z",
      boostedAt: "2026-09-27T10:00:00.000Z",
    },
  });
  await harness.navigate(`/party/${partyId}/settings`);

  await expect(page.getByRole("heading", { name: "Party Boost", exact: true })).toBeVisible();
  await expect(
    page.getByText("A Premium member is boosting this party.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Boost this party", exact: true })).toHaveCount(0);
  await expect(page.getByText(/Last checked/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A Premium member is boosting this party.", { exact: true }),
  ).toBeVisible();
  await harness.setPartyBoost(partyId, {});
  await expect(
    page.getByText("A Premium member is boosting this party.", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(serverChecks).toBe(0);
});

test("waits for personal status and confirms a transfer even when shared state is empty", async ({
  harness,
  page,
}) => {
  const user = { id: "boost-owner", name: "Alex", email: "alex@example.test" };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: { user, session: { userId: user.id } } }),
  );
  const { partyId } = await harness.joinSeededParty({
    fixture: createPartyFixture(),
    participantName: defaultParticipants.alex.name,
  });
  const other = await harness.seedParty(createPartyFixture());
  await harness.setPartyBoost(partyId, {});
  let releaseFirstRead = () => {};
  const firstRead = new Promise<void>((resolve) => {
    releaseFirstRead = resolve;
  });
  let reads = 0;
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/api/premium/party-boost")) writes++;
  });
  await page.route("**/api/premium/party-boost?**", async (route) => {
    if (++reads === 1) {
      await firstRead;
      await route.fulfill({
        status: 503,
        json: { error: { code: "unavailable", message: "Try again" } },
      });
      return;
    }
    await route.fulfill({
      json: {
        currentUser: {
          isPremium: true,
          assignment: {
            active: true,
            partyDocumentId: other.partyId,
            assignedAt: 0,
            transferableAt: 1,
            revokedAt: null,
            revocationReason: null,
          },
        },
        party: { isBoosted: false, isBoostedByCurrentUser: false },
      },
    });
  });
  await harness.navigate(`/party/${partyId}/settings`);
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(retry).toBeDisabled();
  await expect(page.getByRole("button", { name: "Boost this party", exact: true })).toHaveCount(0);
  releaseFirstRead();
  await expect(retry).toBeEnabled();
  await expect(page.getByRole("button", { name: "Boost this party", exact: true })).toHaveCount(0);
  await retry.click();
  await page.getByRole("button", { name: "Move Party Boost here", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Move Party Boost here?", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
});

test("refreshes eligibility after shared revocation and ignores timestamp-only updates", async ({
  harness,
  page,
}) => {
  const user = { id: "boost-owner", name: "Alex", email: "alex@example.test" };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: { user, session: { userId: user.id } } }),
  );
  const { partyId } = await harness.joinSeededParty({
    fixture: createPartyFixture(),
    participantName: defaultParticipants.alex.name,
  });
  const boost = {
    boostId: "test-boost",
    participantId: defaultParticipants.alex.id,
    checkedAt: "2026-09-28T10:00:00.000Z",
    boostedAt: "2026-09-27T10:00:00.000Z",
  };
  await harness.setPartyBoost(partyId, { "test-boost": boost });
  let reads = 0;
  let releaseRefresh = () => {};
  const refresh = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route("**/api/premium/party-boost?**", async (route) => {
    const first = ++reads === 1;
    if (!first) await refresh;
    await route.fulfill({
      json: {
        currentUser: {
          isPremium: first,
          assignment: {
            active: first,
            partyDocumentId: partyId,
            assignedAt: 0,
            transferableAt: 0,
            revokedAt: first ? null : 1,
            revocationReason: first ? null : "premium_inactive",
          },
        },
        party: { isBoosted: first, isBoostedByCurrentUser: first },
      },
    });
  });
  await harness.navigate(`/party/${partyId}/settings`);
  await expect(page.getByRole("button", { name: "Party Boost active", exact: true })).toBeVisible();
  await harness.setPartyBoost(partyId, {
    "test-boost": { ...boost, checkedAt: "2026-09-28T11:00:00.000Z" },
  });
  await expect(page.locator('time[datetime="2026-09-28T11:00:00.000Z"]')).toBeVisible();
  expect(reads).toBe(1);
  await harness.setPartyBoost(partyId, {});
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByRole("button", { name: "Boost this party", exact: true })).toBeEnabled();
  releaseRefresh();
  await expect(
    page.getByRole("button", { name: "View Premium options", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
});

test("a Premium denial survives a stale background read and recovers after verified renewal", async ({
  harness,
  page,
}) => {
  const user = { id: "boost-owner", name: "Alex", email: "alex@example.test" };
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: { user, session: { userId: user.id } } }),
  );
  const { partyId } = await harness.joinSeededParty({
    fixture: createPartyFixture(),
    participantName: defaultParticipants.alex.name,
  });
  await harness.setPartyBoost(partyId, {});
  let releaseStaleRead = () => {};
  const staleRead = new Promise<void>((resolve) => {
    releaseStaleRead = resolve;
  });
  let reads = 0;
  let renewed = false;
  await page.route("**/api/premium/party-boost?**", async (route) => {
    const read = ++reads;
    if (read === 2) await staleRead;
    await route.fulfill({
      json: {
        currentUser: { isPremium: read <= 2 || renewed, assignment: null },
        party: { isBoosted: false, isBoostedByCurrentUser: false },
      },
    });
  });
  await page.route("**/api/premium/party-boost", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: "premium_required", message: "Premium is required for Party Boost." },
      },
    }),
  );
  await harness.navigate(`/party/${partyId}/settings`);
  const activate = page.getByRole("button", { name: "Boost this party", exact: true });
  await expect(activate).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => reads).toBe(2);
  await expect(activate).toBeEnabled();
  await activate.click();
  const upgrade = page.getByRole("button", { name: "View Premium options", exact: true });
  await expect(upgrade).toBeVisible();
  await expect(
    page
      .locator("[data-sonner-toast]")
      .getByText("Premium is required for Party Boost.", { exact: true }),
  ).toBeVisible();
  const staleResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/premium/party-boost?") && response.request().method() === "GET",
  );
  releaseStaleRead();
  await staleResponse;
  await expect(upgrade).toBeVisible();
  // A successful but unverified first-assignment GET must not erase the denial.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => reads).toBe(3);
  await expect(upgrade).toBeVisible();
  await upgrade.click();
  const paywall = page.getByRole("dialog", { name: "trizum Premium", exact: true });
  await expect(paywall).toBeVisible();
  await paywall.getByRole("button", { name: "Redeem code", exact: true }).click();
  await paywall.getByRole("textbox", { name: "Promo code", exact: true }).fill("FRIENDS");
  await expect(
    paywall.getByRole("link", { name: "Redeem in App Store", exact: true }),
  ).toHaveAttribute("href", /code=FRIENDS$/);
  await paywall.getByRole("button", { name: "Close Premium", exact: true }).click();
  await expect(paywall).toHaveCount(0);
  await expect.poll(() => reads).toBe(4);
  await expect(upgrade).toBeEnabled();
  renewed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(activate).toBeEnabled();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
});
