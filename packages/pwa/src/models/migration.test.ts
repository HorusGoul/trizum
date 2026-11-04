import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { Party } from "./party";
import type { getMediaFileHelpers } from "#src/hooks/useMediaFileActions.ts";
import { i18n } from "@lingui/core";

const addExpenseToPartyMock =
  vi.fn<(expense: MigrationData["expenses"][number]) => Promise<void>>();

const createMediaFileMock = vi.hoisted(() =>
  vi.fn<ReturnType<typeof getMediaFileHelpers>["createMediaFile"]>(),
);

vi.mock("#src/hooks/useParty.ts", () => ({
  getPartyHelpers: () => ({
    addExpenseToParty: addExpenseToPartyMock,
  }),
}));

vi.mock("#src/hooks/useMediaFileActions.ts", () => ({
  getMediaFileHelpers: () => ({
    createMediaFile: createMediaFileMock,
  }),
}));

import { createPartyFromMigrationData, type MigrationData } from "./migration";

const testRepos: Repo[] = [];

function createMockRepo() {
  const repo = new Repo({ network: [] });
  testRepos.push(repo);
  const create = vi.spyOn(repo, "create");

  return {
    repo,
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
    addExpenseToPartyMock.mockReset();
    createMediaFileMock.mockReset();
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
    expect(createMediaFileMock).not.toHaveBeenCalled();
    expect(addExpenseToPartyMock).not.toHaveBeenCalled();
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
