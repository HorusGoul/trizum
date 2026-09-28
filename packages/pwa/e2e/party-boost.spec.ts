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
