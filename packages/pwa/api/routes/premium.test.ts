import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { createPartyBoostTestHarness } from "../premium/partyBoostTestHarness";
import { PARTY_BOOST_TRANSFER_INTERVAL_MS } from "../premium/partyBoost";

vi.mock("cloudflare:email", () => ({ EmailMessage: class EmailMessage {} }));

describe("Party Boost HTTP lifecycle with local D1", () => {
  let harness: Awaited<ReturnType<typeof createPartyBoostTestHarness>>;
  beforeAll(async () => {
    harness = await createPartyBoostTestHarness();
  }, 30_000);
  afterAll(async () => {
    await harness?.dispose();
  });
  beforeEach(() => {
    harness.requests.length = 0;
  });
  afterEach(() => {
    harness.setRevenueCatStatus(200);
    harness.setSyncUnavailable(false);
    harness.env.REVENUECAT_SECRET_API_KEY = "test-only-key";
  });

  test("activates for a signed-in Premium member and exposes the boost to another member", async () => {
    const owner = await harness.createUser();
    const member = await harness.createUser();
    const party = harness.createParty();
    owner.join(party);
    member.join(party);
    harness.customers.set(owner.id, "subscription");
    const response = await harness.request("PUT", party, owner.cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      currentUser: { isPremium: true, assignment: { active: true, partyDocumentId: party } },
      party: { isBoosted: true, isBoostedByCurrentUser: true },
    });
    const shared = await harness.request("GET", party, member.cookie);
    expect(shared.status).toBe(200);
    expect(await shared.json()).toMatchObject({
      currentUser: { isPremium: false, assignment: null },
      party: { isBoosted: true, isBoostedByCurrentUser: false },
    });
    expect(
      harness.requests.every(
        (request) => new URL(request.url).searchParams.get("environment") === "production",
      ),
    ).toBe(true);
  });

  test.each(["GET", "PUT"] as const)("requires authentication for %s", async (method) => {
    const response = await harness.request(method, harness.createParty());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
    expect(harness.requests).toHaveLength(0);
  });

  test("rejects malformed IDs and non-members before checking RevenueCat", async () => {
    const user = await harness.createUser();
    const invalid = await harness.request("PUT", "not-a-document-id", user.cookie);
    expect(invalid.status).toBe(400);
    const forbidden = await harness.request("PUT", harness.createParty(), user.cookie);
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({ error: { code: "membership_required" } });
    expect(harness.requests).toHaveLength(0);
    expect(await harness.assignment(user.id)).toBeNull();
  });

  test.each(["inactive", "sandbox", "family_shared", "test_store"] as const)(
    "rejects %s access without writing an assignment",
    async (access) => {
      const user = await harness.createUser();
      const party = harness.createParty();
      user.join(party);
      harness.customers.set(user.id, access);
      const response = await harness.request("PUT", party, user.cookie);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: { code: "premium_required" } });
      expect(await harness.assignment(user.id)).toBeNull();
      expect(harness.requests).toHaveLength(2);
    },
  );

  test("accepts a directly owned lifetime purchase", async () => {
    const user = await harness.createUser();
    const party = harness.createParty();
    user.join(party);
    harness.customers.set(user.id, "lifetime");
    expect((await harness.request("PUT", party, user.cookie)).status).toBe(200);
    expect(await harness.assignment(user.id)).toMatchObject({
      partyDocumentId: party,
      revokedAt: null,
    });
  });

  test("keeps repeat activation idempotent and blocks moving during cooldown", async () => {
    const { owner, party } = await activate();
    const initial = await harness.assignment(owner.id);
    expect(initial!.transferableAt - initial!.assignedAt).toBe(PARTY_BOOST_TRANSFER_INTERVAL_MS);
    expect((await harness.request("PUT", party, owner.cookie)).status).toBe(200);
    expect(await harness.assignment(owner.id)).toEqual(initial);
    const other = harness.createParty();
    owner.join(other);
    const blocked = await harness.request("PUT", other, owner.cookie);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toMatchObject({
      error: { code: "transfer_locked", transferableAt: initial!.transferableAt },
    });
    expect(await harness.assignment(owner.id)).toEqual(initial);
  });

  test("moves after cooldown and clears the original party boost", async () => {
    const { owner, party } = await activate();
    const other = harness.createParty();
    owner.join(other);
    await harness.env.DB.prepare("UPDATE party_boost SET transferableAt = ? WHERE ownerUserId = ?")
      .bind(Date.now() - 1, owner.id)
      .run();
    const moved = await harness.request("PUT", other, owner.cookie);
    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({
      party: { isBoosted: true, isBoostedByCurrentUser: true },
    });
    const stored = await harness.assignment(owner.id);
    expect(stored).toMatchObject({ partyDocumentId: other, version: 1, revokedAt: null });
    expect(stored!.transferableAt - stored!.assignedAt).toBe(PARTY_BOOST_TRANSFER_INTERVAL_MS);
    const previous = await harness.request("GET", party, owner.cookie);
    expect(await previous.json()).toMatchObject({
      party: { isBoosted: false, isBoostedByCurrentUser: false },
    });
  });

  test("revokes expired Premium on a member's status request and lets another eligible owner take over", async () => {
    const { owner, party } = await activate();
    const member = await harness.createUser();
    member.join(party);
    harness.customers.set(owner.id, "inactive");
    const status = await harness.request("GET", party, member.cookie);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ party: { isBoosted: false } });
    expect(await harness.assignment(owner.id)).toMatchObject({
      revocationReason: "premium_inactive",
      version: 1,
    });
    harness.customers.set(member.id, "subscription");
    expect((await harness.request("PUT", party, member.cookie)).status).toBe(200);
    expect(await harness.assignment(member.id)).toMatchObject({
      revokedAt: null,
      partyDocumentId: party,
    });
  });

  test("reactivates after Premium recovery without resetting the transfer cooldown", async () => {
    const { owner, party } = await activate();
    const initial = await harness.assignment(owner.id);
    harness.customers.set(owner.id, "inactive");
    expect((await harness.request("PUT", party, owner.cookie)).status).toBe(403);
    expect(await harness.assignment(owner.id)).toMatchObject({
      revocationReason: "premium_inactive",
      version: 1,
    });
    harness.customers.set(owner.id, "subscription");
    expect((await harness.request("PUT", party, owner.cookie)).status).toBe(200);
    expect(await harness.assignment(owner.id)).toMatchObject({
      assignedAt: initial!.assignedAt,
      transferableAt: initial!.transferableAt,
      revokedAt: null,
      revocationReason: null,
      version: 2,
    });
  });

  test("revokes when the owner is archived even if their party list still references the party", async () => {
    const { owner, party } = await activate();
    const member = await harness.createUser();
    member.join(party);
    owner.leave(party);
    expect((await harness.request("GET", party, owner.cookie)).status).toBe(403);
    const status = await harness.request("GET", party, member.cookie);
    expect(await status.json()).toMatchObject({ party: { isBoosted: false } });
    expect(await harness.assignment(owner.id)).toMatchObject({
      revocationReason: "owner_not_member",
      version: 1,
    });
  });

  test("revokes an owner's old assignment when they inspect another party after losing membership", async () => {
    const { owner, party } = await activate();
    const other = harness.createParty();
    owner.join(other);
    owner.leave(party);
    const status = await harness.request("GET", other, owner.cookie);
    expect(await status.json()).toMatchObject({
      currentUser: { assignment: { active: false, revocationReason: "owner_not_member" } },
      party: { isBoosted: false },
    });
  });

  test("rejects a competing owner without changing the existing assignment", async () => {
    const { owner, party } = await activate();
    const initial = await harness.assignment(owner.id);
    const other = await harness.createUser();
    other.join(party);
    harness.customers.set(other.id, "subscription");
    const response = await harness.request("PUT", party, other.cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "already_boosted" } });
    expect(await harness.assignment(owner.id)).toEqual(initial);
    expect(await harness.assignment(other.id)).toBeNull();
  });

  test("allows only one winner when two owners activate the same party concurrently", async () => {
    const owners = await Promise.all([harness.createUser(), harness.createUser()]);
    const party = harness.createParty();
    for (const owner of owners) {
      owner.join(party);
      harness.customers.set(owner.id, "subscription");
    }
    const responses = await Promise.all(
      owners.map((owner) => harness.request("PUT", party, owner.cookie)),
    );
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const stored = await Promise.all(owners.map((owner) => harness.assignment(owner.id)));
    expect(stored.filter((row) => row?.revokedAt === null)).toHaveLength(1);
  });

  test("allows only one assignment when one owner activates two parties concurrently", async () => {
    const owner = await harness.createUser();
    const parties = [harness.createParty(), harness.createParty()];
    for (const party of parties) owner.join(party);
    harness.customers.set(owner.id, "subscription");
    const responses = await Promise.all(
      parties.map((party) => harness.request("PUT", party, owner.cookie)),
    );
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const active = await harness.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM party_boost WHERE ownerUserId = ? AND revokedAt IS NULL",
    )
      .bind(owner.id)
      .first<{ count: number }>();
    expect(active?.count).toBe(1);
  });

  test.each([401, 403, 429, 500])(
    "returns 503 on RevenueCat HTTP %s without revoking a valid assignment",
    async (failureStatus) => {
      const { owner, party } = await activate();
      const initial = await harness.assignment(owner.id);
      harness.setRevenueCatStatus(failureStatus);
      const response = await harness.request("GET", party, owner.cookie);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "unavailable" } });
      expect(await harness.assignment(owner.id)).toEqual(initial);
    },
  );

  test("returns 503 when the key is absent without deleting the assignment", async () => {
    const { owner, party } = await activate();
    const initial = await harness.assignment(owner.id);
    harness.env.REVENUECAT_SECRET_API_KEY = undefined;
    expect((await harness.request("GET", party, owner.cookie)).status).toBe(503);
    expect(await harness.assignment(owner.id)).toEqual(initial);
  });

  test("returns 503 on a sync outage and recovers without losing the assignment", async () => {
    const { owner, party } = await activate();
    const initial = await harness.assignment(owner.id);
    harness.setSyncUnavailable(true);
    expect((await harness.request("GET", party, owner.cookie)).status).toBe(503);
    expect(await harness.assignment(owner.id)).toEqual(initial);
    harness.setSyncUnavailable(false);
    const response = await harness.request("GET", party, owner.cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ party: { isBoosted: true } });
  });

  async function activate() {
    const owner = await harness.createUser();
    const party = harness.createParty();
    owner.join(party);
    harness.customers.set(owner.id, "subscription");
    expect((await harness.request("PUT", party, owner.cookie)).status).toBe(200);
    return { owner, party };
  }
});
