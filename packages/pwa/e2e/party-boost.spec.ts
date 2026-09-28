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
