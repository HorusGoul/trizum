import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Party } from "./party";
import { i18n } from "@lingui/core";

import { createPartyFromMigrationData, type MigrationData } from "./migration";

const testRepos: Repo[] = [];

function createMockRepo() {
  const repo = new Repo({ network: [] });
  testRepos.push(repo);
  const create = vi.spyOn(repo, "create");

  return {
    repo,
    create,
    getLastCreatedHandle() {
      const result = create.mock.results.at(-1);

      if (!result || result.type !== "return")
        throw new Error("Expected a created document handle");

      // SAFETY: This fixture observes only the Party created by the helper under test.
      const handle = result.value as DocHandle<Party>;

      return handle;
    },
  };
}

function createMigrationData(
  partyOverrides: Partial<MigrationData["party"]> = {},
  dataOverrides: Partial<Pick<MigrationData, "expenses" | "photos">> = {},
): MigrationData {
  return {
    party: {
      type: "party",
      name: "Andalusian Point",
      description: "Trip to the best place in the world",
      currency: "EUR",
      participants: {},
      ...partyOverrides,
    },
    expenses: dataOverrides.expenses ?? [],
    photos: dataOverrides.photos ?? [],
  };
}

describe("createPartyFromMigrationData", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  afterEach(async () => {
    await Promise.all(testRepos.splice(0).map((repo) => repo.shutdown()));
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("rejects failed attachment downloads before creating media", async () => {
    const mockRepo = createMockRepo();
    const response = new Response("Not found", { status: 404 });
    const readBlob = vi.spyOn(response, "blob");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));

    await expect(
      createPartyFromMigrationData({
        repo: mockRepo.repo,
        data: createMigrationData(
          {},
          { photos: [{ id: "receipt", url: "https://example.com/receipt.jpg" }] },
        ),
        importAttachments: true,
      }),
    ).rejects.toThrow("Error importing photos: Could not import attachment (HTTP 404)");
    expect(readBlob).not.toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalledOnce();
    expect(mockRepo.getLastCreatedHandle().doc().chunkRefs).toEqual([]);
  });

  test("omits an undefined party symbol before creating the Automerge document", async () => {
    const mockRepo = createMockRepo();

    await expect(
      createPartyFromMigrationData({
        repo: mockRepo.repo,
        data: createMigrationData(),
      }),
    ).resolves.toBe(mockRepo.getLastCreatedHandle().documentId);

    expect(mockRepo.getLastCreatedHandle().doc()).not.toHaveProperty("symbol");
  });

  test("preserves the party symbol when migration data includes one", async () => {
    const mockRepo = createMockRepo();

    await createPartyFromMigrationData({
      repo: mockRepo.repo,
      data: createMigrationData({
        symbol: "🏕️",
      }),
    });

    expect(mockRepo.getLastCreatedHandle().doc()).toMatchObject({
      symbol: "🏕️",
    });
  });
});
