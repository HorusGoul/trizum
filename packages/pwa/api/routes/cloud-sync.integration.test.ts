import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { createPartyBoostTestHarness } from "../premium/partyBoostTestHarness";
import { getApiDb } from "../db/client";
import { cloudSyncRoute, createCloudSettingsStore } from "./cloud-sync";

let harness: Awaited<ReturnType<typeof createPartyBoostTestHarness>>;

beforeAll(async () => {
  harness = await createPartyBoostTestHarness();
}, 30_000);

afterAll(async () => {
  await harness?.dispose();
});

function documentId() {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}

function request(method: "GET" | "PUT", cookie?: string, partyListDocumentId?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });

  if (cookie) headers.set("Cookie", cookie);

  return cloudSyncRoute.fetch(
    new Request("http://localhost:8787/settings", {
      method,
      headers,
      body: method === "PUT" ? JSON.stringify({ partyListDocumentId }) : undefined,
    }),
    harness.env,
    {
      waitUntil: () => {},
      passThroughOnException: () => {},
      props: {},
    },
  );
}

test("runs authenticated settings reads and immutable setup through real auth and D1", async () => {
  const owner = await harness.createUser();
  const other = await harness.createUser();
  const store = createCloudSettingsStore(getApiDb(harness.env.DB));
  const settings = (await store.read(owner.id))!;
  expect((await request("GET")).status).toBe(401);
  const response = await request("GET", owner.cookie);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ settings });
  const repeated = await request("PUT", owner.cookie, settings.partyListDocumentId);
  expect(repeated.status).toBe(200);
  expect(await repeated.json()).toEqual({ settings });
  expect((await request("PUT", owner.cookie, documentId())).status).toBe(409);
  expect(await store.read(owner.id)).toEqual(settings);
  expect((await store.read(other.id))?.partyListDocumentId).not.toBe(settings.partyListDocumentId);
});

test("D1 insert-if-missing preserves the winner of competing profile setup writes", async () => {
  const owner = await harness.createUser();
  await harness.env.DB.prepare("DELETE FROM cloud_user_settings WHERE userId = ?")
    .bind(owner.id)
    .run();
  const store = createCloudSettingsStore(getApiDb(harness.env.DB));
  expect(await store.read(owner.id)).toBeUndefined();
  const first = { partyListDocumentId: documentId(), updatedAt: 123 };
  const second = { partyListDocumentId: documentId(), updatedAt: 456 };
  await Promise.all([
    store.insertIfMissing({ ...first, userId: owner.id }),
    store.insertIfMissing({ ...second, userId: owner.id }),
  ]);
  const winner = await store.read(owner.id);
  expect([first, second]).toContainEqual(winner);
  await store.insertIfMissing({ ...second, updatedAt: 789, userId: owner.id });
  expect(await store.read(owner.id)).toEqual(winner);
});
