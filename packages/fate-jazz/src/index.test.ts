import { describe, expect, test, vi } from "vite-plus/test";
import type { AuthSecretStore } from "jazz-tools";
import {
  createJazzFateTransport,
  projectEntity,
  resolveJazzFateAuthConfig,
  type JazzFateEntity,
  type JazzFateRepository,
} from "./index.js";

type NoteEntity = JazzFateEntity & {
  __typename: "Note";
  body?: string;
  privateMemo?: string;
  title?: string;
};

type MutationMap = {
  "note.create": {
    input: {
      body: string;
      privateMemo?: string;
      title: string;
    };
    output: NoteEntity;
  };
};

describe("Jazz Fate auth", () => {
  test("defaults product-local users to Jazz local-first auth", async () => {
    const secretStore = {
      clearSecret: vi.fn<() => Promise<void>>(async () => {}),
      getOrCreateSecret: vi.fn<() => Promise<string>>(async () => "local-first-secret"),
      loadSecret: vi.fn<() => Promise<string | null>>(async () => null),
      saveSecret: vi.fn<(secret: string) => Promise<void>>(async (_secret) => {}),
    } satisfies AuthSecretStore;

    await expect(
      resolveJazzFateAuthConfig("fate-jazz-test", {
        secretStore,
      }),
    ).resolves.toStrictEqual({
      secret: "local-first-secret",
    });

    expect(secretStore.getOrCreateSecret).toHaveBeenCalledTimes(1);
  });

  test("keeps Jazz anonymous mode explicit for guest/read-limited sessions", async () => {
    await expect(
      resolveJazzFateAuthConfig("fate-jazz-test", {
        mode: "anonymousGuest",
      }),
    ).resolves.toStrictEqual({});
  });
});

describe("Fate Jazz transport", () => {
  test("passes Fate fetch selections to repositories", async () => {
    const repository = createMemoryRepository();
    const transport = createJazzFateTransport<MutationMap>(repository);

    await expect(
      transport.fetchById("Note", ["note-1"], ["id", "title", "privateMemo"]),
    ).resolves.toStrictEqual([
      {
        __typename: "Note",
        id: "note-1",
        title: "Roadmap",
      },
    ]);

    expect(repository.fetches.at(0)).toStrictEqual({
      ids: ["note-1"],
      select: ["id", "title", "privateMemo"],
      type: "Note",
    });
  });

  test("projects mutation output to the Fate selection", async () => {
    const repository = createMemoryRepository();
    const transport = createJazzFateTransport<MutationMap>(repository);

    await expect(
      transport.mutate?.(
        "note.create",
        {
          body: "Ship the package split",
          privateMemo: "implementation detail",
          title: "Roadmap",
        },
        new Set(["id", "title"]),
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-2",
      title: "Roadmap",
    });
  });
});

describe("projectEntity", () => {
  test("keeps Fate id and typename while masking unselected or disallowed columns", () => {
    expect(
      projectEntity<NoteEntity>(
        {
          __typename: "Note",
          body: "Visible in detail views",
          id: "note-1",
          privateMemo: "hidden",
          title: "Roadmap",
        },
        ["id", "title", "privateMemo"],
        ["id", "body", "title"],
      ),
    ).toStrictEqual({
      __typename: "Note",
      id: "note-1",
      title: "Roadmap",
    });
  });
});

function createMemoryRepository() {
  const notes: NoteEntity[] = [
    {
      __typename: "Note",
      body: "Visible in detail views",
      id: "note-1",
      privateMemo: "hidden",
      title: "Roadmap",
    },
  ];

  const repository: JazzFateRepository<NoteEntity, MutationMap> & {
    fetches: Array<{
      ids: Array<string | number>;
      select: string[];
      type: string;
    }>;
  } = {
    entityTypes: new Set(["Note"]),
    fetches: [],
    listRoots: new Set(["notes"]),

    async fetchEntities(type, ids, select) {
      repository.fetches.push({ ids, select: [...select], type });
      return ids.map((id) => {
        const entity = notes.find((candidate) => candidate.id === id);
        return entity ? projectEntity(entity, select, ["id", "body", "title"]) : null;
      });
    },

    async fetchList(_root, select) {
      return {
        items: notes.map((entity) => {
          const node = projectEntity(entity, select, ["id", "body", "title"]);

          return {
            cursor: String(node.id),
            node,
          };
        }),
        pagination: {
          hasNext: false,
          hasPrevious: false,
        },
      };
    },

    async mutate(proc, input, select) {
      if (proc !== "note.create") {
        throw new Error(`Unsupported mutation in test: ${String(proc)}`);
      }

      const note: NoteEntity = {
        __typename: "Note",
        id: `note-${notes.length + 1}`,
        ...input,
      };

      notes.push(note);

      return projectEntity(note, select, ["id", "body", "title"]);
    },
  };

  return repository;
}
