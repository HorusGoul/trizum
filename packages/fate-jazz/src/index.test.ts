import { describe, expect, test, vi } from "vite-plus/test";
import type { AuthSecretStore } from "jazz-tools";
import {
  applyJazzFateMutationToCache,
  applyJazzFateSyncRejectionToCache,
  createJazzDbRepository,
  createJazzFateTransport,
  projectEntity,
  refreshJazzFateCache,
  resolveJazzFateAuthConfig,
  subscribeToJazzFateCacheUpdates,
  type JazzFateEntity,
  type JazzFateDb,
  type JazzFateRepository,
} from "./index.js";

type NoteEntity = JazzFateEntity & {
  __typename: "Note";
  body?: string;
  createdAt?: number;
  privateMemo?: string;
  projectId?: string;
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
  "note.upsert": {
    input: {
      body: string;
      createdAt: number;
      id: string;
      privateMemo?: string;
      projectId: string;
      title: string;
    };
    output: NoteEntity;
  };
  "note.update": {
    input: {
      body: string;
      createdAt: number;
      id: string;
      projectId: string;
      title: string;
    };
    output: NoteEntity;
  };
  "note.delete": {
    input: {
      id: string;
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

describe("Jazz DB repository", () => {
  test("supports ordered offset pagination for Jazz-backed Fate lists", async () => {
    const table = new FakeNoteQuery([
      createNoteRow("note-1", "project-1", "Oldest", 1),
      createNoteRow("note-2", "project-1", "Middle", 2),
      createNoteRow("note-3", "project-1", "Newest", 3),
      createNoteRow("note-4", "project-1", "Overflow", 4),
      createNoteRow("note-5", "project-2", "Other project", 5),
    ]);
    const queryOptions: unknown[] = [];
    const db = {
      async all(query: unknown, options: unknown) {
        queryOptions.push(options);
        return (query as FakeNoteQuery).execute();
      },
      insert(_table: unknown, _input: unknown) {
        throw new Error("insert is not used by this test");
      },
      async one(_query: unknown) {
        throw new Error("one is not used by this test");
      },
    } as unknown as JazzFateDb;
    const repository = createJazzDbRepository<NoteEntity>({
      db,
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [
        {
          orderBy: {
            column: "createdAt",
            direction: "asc",
          },
          pagination: "offset",
          root: "notes",
          type: "Note",
          where(args) {
            return {
              projectId: args?.projectId,
            };
          },
        },
      ],
    });

    await expect(
      repository.fetchList("notes", ["id", "title", "privateMemo"], {
        after: "1",
        first: 2,
        projectId: "project-1",
      }),
    ).resolves.toStrictEqual({
      items: [
        {
          cursor: "note-2",
          node: {
            __typename: "Note",
            id: "note-2",
            title: "Middle",
          },
        },
        {
          cursor: "note-3",
          node: {
            __typename: "Note",
            id: "note-3",
            title: "Newest",
          },
        },
      ],
      pagination: {
        hasNext: true,
        hasPrevious: true,
        nextCursor: "3",
        previousCursor: "0",
      },
    });
    expect(queryOptions).toStrictEqual([{}]);
    expect(table.calls).toStrictEqual([
      {
        conditions: {
          projectId: "project-1",
        },
        method: "where",
      },
      {
        column: "createdAt",
        direction: "asc",
        method: "orderBy",
      },
      {
        columns: ["id", "title", "createdAt"],
        method: "select",
      },
    ]);
  });

  test("rereads upserted rows through the Fate selection", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "upsert",
          proc: "note.upsert",
          table,
          type: "Note",
        },
      ],
    });

    await expect(
      repository.mutate?.(
        "note.upsert",
        {
          body: "Visible details",
          createdAt: 2,
          id: "note-2",
          privateMemo: "hidden",
          projectId: "project-1",
          title: "Draft",
        },
        ["id", "title", "privateMemo"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-2",
      title: "Draft",
    });
    expect(table.calls).toStrictEqual([
      {
        conditions: {
          id: "note-2",
        },
        method: "where",
      },
      {
        columns: ["id", "body", "createdAt", "projectId", "title"],
        method: "select",
      },
      {
        conditions: {
          id: "note-2",
        },
        method: "where",
      },
      {
        columns: ["id", "title"],
        method: "select",
      },
      {
        data: {
          body: "Visible details",
          createdAt: 2,
          privateMemo: "hidden",
          projectId: "project-1",
          title: "Draft",
        },
        id: "note-2",
        method: "upsert",
      },
      {
        conditions: {
          id: "note-2",
        },
        method: "where",
      },
      {
        columns: ["id", "title"],
        method: "select",
      },
    ]);
  });

  test("rereads updated rows through the Fate selection when Jazz returns partial values", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table, {
        updateValue: {
          id: "note-1",
          title: "Updated",
        },
      }),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "update",
          proc: "note.update",
          table,
          type: "Note",
        },
      ],
    });

    await expect(
      repository.mutate?.(
        "note.update",
        {
          body: "Updated body",
          createdAt: 2,
          id: "note-1",
          projectId: "project-1",
          title: "Updated",
        },
        ["id", "title", "body"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      body: "Updated body",
      id: "note-1",
      title: "Updated",
    });
  });

  test("keeps background writes local when reads target the edge", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const waits: unknown[] = [];
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table, {
        wait: async (options) => {
          waits.push(options);

          if (options.tier === "edge") {
            await new Promise(() => {});
          }
        },
      }),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "upsert",
          proc: "note.upsert",
          table,
          type: "Note",
        },
      ],
      queryOptions: { tier: "edge" },
      syncWritesToTier: "edge",
    });

    await expect(
      repository.mutate?.(
        "note.upsert",
        {
          body: "Visible details",
          createdAt: 2,
          id: "note-2",
          projectId: "project-1",
          title: "Draft",
        },
        ["id", "title"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-2",
      title: "Draft",
    });

    expect(waits).toStrictEqual([{ tier: "local" }, { tier: "edge" }]);
  });

  test("compensates local rows when background edge sync rejects", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table, {
        wait: async (options) => {
          if (options.tier === "edge") {
            throw new Error("server denied write");
          }
        },
      }),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "upsert",
          proc: "note.upsert",
          table,
          type: "Note",
        },
      ],
      syncWritesToTier: "edge",
    });

    await expect(
      repository.mutate?.(
        "note.upsert",
        {
          body: "Visible details",
          createdAt: 2,
          id: "note-2",
          projectId: "project-1",
          title: "Draft",
        },
        ["id", "title"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-2",
      title: "Draft",
    });

    await vi.waitFor(() => expect(table.find("note-2")).toBeUndefined());
  });

  test("restores updated local rows when background edge sync rejects", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table, {
        wait: async (options) => {
          if (options.tier === "edge") {
            throw new Error("server denied write");
          }
        },
      }),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "update",
          proc: "note.update",
          table,
          type: "Note",
        },
      ],
      syncWritesToTier: "edge",
    });

    await expect(
      repository.mutate?.(
        "note.update",
        {
          body: "Updated body",
          createdAt: 2,
          id: "note-1",
          projectId: "project-1",
          title: "Updated",
        },
        ["id", "title"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-1",
      title: "Updated",
    });

    await vi.waitFor(() => expect(table.find("note-1")?.title).toBe("Oldest"));
  });

  test("restores deleted local rows when background edge sync rejects", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table, {
        wait: async (options) => {
          if (options.tier === "edge") {
            throw new Error("server denied write");
          }
        },
      }),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "delete",
          proc: "note.delete",
          table,
          type: "Note",
        },
      ],
      syncWritesToTier: "edge",
    });

    await expect(
      repository.mutate?.("note.delete", { id: "note-1" }, ["id", "title"]),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-1",
      title: "Oldest",
    });

    await vi.waitFor(() => expect(table.find("note-1")?.title).toBe("Oldest"));
    expect(table.calls.some((call) => call.method === "delete" && call.id === "note-1")).toBe(true);
  });

  test("emits sync rejection events with masked rollback data", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const onSyncRejected = vi.fn<(event: unknown) => void>();
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: createFakeNoteDb(table, {
        wait: async (options) => {
          if (options.tier === "edge") {
            throw new Error("server denied write");
          }
        },
      }),
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "upsert",
          proc: "note.upsert",
          table,
          type: "Note",
        },
      ],
      syncWritesToTier: "edge",
    });
    const transport = createJazzFateTransport(repository, {
      onSyncRejected,
    });

    await expect(
      transport.mutate?.(
        "note.upsert",
        {
          body: "Updated body",
          createdAt: 3,
          id: "note-1",
          privateMemo: "still hidden",
          projectId: "project-1",
          title: "Updated",
        },
        new Set(["id", "title", "privateMemo"]),
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-1",
      title: "Updated",
    });

    await vi.waitFor(() => expect(onSyncRejected).toHaveBeenCalledTimes(1));
    expect(onSyncRejected).toHaveBeenCalledWith({
      affectedLists: [],
      error: expect.any(Error),
      input: {
        body: "Updated body",
        createdAt: 3,
        id: "note-1",
        privateMemo: "still hidden",
        projectId: "project-1",
        title: "Updated",
      },
      operation: "upsert",
      output: {
        __typename: "Note",
        id: "note-1",
        title: "Updated",
      },
      proc: "note.upsert",
      rollbackOutput: {
        __typename: "Note",
        id: "note-1",
        title: "Oldest",
      },
    });
  });

  test("uses returned upsert rows when immediate rereads are unavailable", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: {
        async all() {
          throw new Error("all is not used by this test");
        },
        insert() {
          throw new Error("insert is not used by this test");
        },
        async one() {
          return null;
        },
        update() {
          throw new Error("update is not used by this test");
        },
        upsert(_table: unknown, input: unknown, options: { id: string }) {
          const row = table.upsert(options.id, input as Partial<NoteRow>);

          return {
            value: row,
            wait: async () => {},
          };
        },
      } as unknown as JazzFateDb,
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "upsert",
          proc: "note.upsert",
          table,
          type: "Note",
        },
      ],
    });

    await expect(
      repository.mutate?.(
        "note.upsert",
        {
          body: "Visible details",
          createdAt: 2,
          id: "note-2",
          privateMemo: "hidden",
          projectId: "project-1",
          title: "Draft",
        },
        ["id", "title", "privateMemo"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-2",
      title: "Draft",
    });
  });

  test("uses upsert inputs when Jazz cannot immediately reread the row", async () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Oldest", 1)]);
    const repository = createJazzDbRepository<NoteEntity, MutationMap>({
      db: {
        async all() {
          throw new Error("all is not used by this test");
        },
        insert() {
          throw new Error("insert is not used by this test");
        },
        async one() {
          return null;
        },
        update() {
          throw new Error("update is not used by this test");
        },
        upsert(_table: unknown, input: unknown, options: { id: string }) {
          table.upsert(options.id, input as Partial<NoteRow>);

          return {
            wait: async () => {},
          };
        },
      } as unknown as JazzFateDb,
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
      mutations: [
        {
          operation: "upsert",
          proc: "note.upsert",
          table,
          type: "Note",
        },
      ],
    });

    await expect(
      repository.mutate?.(
        "note.upsert",
        {
          body: "Visible details",
          createdAt: 2,
          id: "note-2",
          privateMemo: "hidden",
          projectId: "project-1",
          title: "Draft",
        },
        ["id", "title", "privateMemo"],
      ),
    ).resolves.toStrictEqual({
      __typename: "Note",
      id: "note-2",
      title: "Draft",
    });
  });

  test("restores requested ids on by-id reads when Jazz omits id from the row", async () => {
    const table = {
      select: () => table,
      where: () => table,
    };
    const repository = createJazzDbRepository<NoteEntity>({
      db: {
        async all() {
          throw new Error("all is not used by this test");
        },
        insert() {
          throw new Error("insert is not used by this test");
        },
        async one() {
          return {
            title: "Roadmap",
          };
        },
      } as unknown as JazzFateDb,
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
    });

    await expect(repository.fetchEntities("Note", ["note-1"], ["id", "title"])).resolves.toEqual([
      {
        __typename: "Note",
        id: "note-1",
        title: "Roadmap",
      },
    ]);
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

  test("resolves fetched entities before Fate normalizes them", async () => {
    const repository = createMemoryRepository();
    const transport = createJazzFateTransport<MutationMap>(repository, {
      resolveFetchedEntity(entity) {
        return entity.__typename === "Note"
          ? {
              ...entity,
              title: "Fresh cached title",
            }
          : entity;
      },
    });

    await expect(transport.fetchById("Note", ["note-1"], ["id", "title"])).resolves.toStrictEqual([
      {
        __typename: "Note",
        id: "note-1",
        title: "Fresh cached title",
      },
    ]);
    await expect(transport.fetchList?.("notes", ["id", "title"])).resolves.toMatchObject({
      items: [
        {
          node: {
            __typename: "Note",
            id: "note-1",
            title: "Fresh cached title",
          },
        },
      ],
    });
  });

  test("forwards the first Jazz subscription snapshot", () => {
    const table = new FakeNoteQuery([createNoteRow("note-1", "project-1", "Initial", 1)]);
    const unsubscribe = vi.fn<() => void>();
    const db = {
      ...createFakeNoteDb(table),
      subscribeAll(query: unknown, callback: (delta: unknown) => void) {
        callback({
          all: (query as FakeNoteQuery).execute(),
          delta: [],
        });

        return unsubscribe;
      },
    } as unknown as JazzFateDb;
    const repository = createJazzDbRepository<NoteEntity>({
      db,
      entities: [
        {
          columns: ["id", "body", "createdAt", "projectId", "title"],
          table,
          type: "Note",
        },
      ],
      lists: [],
    });
    const onChange = vi.fn<() => void>();
    const dispose = repository.subscribeEntities?.(
      "Note",
      ["note-1"],
      ["id", "title"],
      {},
      onChange,
    );

    expect(onChange).toHaveBeenCalledTimes(1);

    dispose?.();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
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

  test("emits affected live list nodes after mutations", async () => {
    const repository = createMemoryRepository();
    const transport = createJazzFateTransport<MutationMap>(repository);
    const events: unknown[] = [];
    const unsubscribe = transport.subscribeConnection?.(
      "notes",
      "Note",
      {},
      new Set(["id", "title"]),
      undefined,
      {
        onEvent(event) {
          events.push(event);
        },
      },
    );

    await transport.mutate?.(
      "note.create",
      {
        body: "Ship the package split",
        title: "Roadmap",
      },
      new Set(["id", "title"]),
    );

    expect(events).toStrictEqual([
      {
        edge: {
          cursor: "note-2",
          node: {
            __typename: "Note",
            id: "note-2",
            title: "Roadmap",
          },
        },
        nodeType: "Note",
        type: "prependNode",
      },
    ]);
    unsubscribe?.();
  });

  test("invalidates and refreshes live list connections when Jazz subscriptions change", async () => {
    const repository = createMemoryRepository();
    let emitRemoteChange: (() => void) | undefined;
    const unsubscribeRemote = vi.fn<() => void>();
    repository.subscribeList = vi.fn<NonNullable<typeof repository.subscribeList>>(
      (_root, _select, _args, onChange) => {
        emitRemoteChange = onChange;

        return unsubscribeRemote;
      },
    );
    const liveDataEvents: unknown[] = [];
    const transport = createJazzFateTransport<MutationMap>(repository, {
      onLiveData(event) {
        liveDataEvents.push(event);
      },
    });
    const events: unknown[] = [];
    const unsubscribe = transport.subscribeConnection?.(
      "notes",
      "Note",
      { projectId: "project-1" },
      new Set(["id", "title"]),
      undefined,
      {
        onEvent(event) {
          events.push(event);
        },
      },
    );

    emitRemoteChange?.();

    expect(events).toStrictEqual([{ type: "invalidate" }]);
    await vi.waitFor(() =>
      expect(liveDataEvents).toStrictEqual([
        {
          affectedLists: [{ args: { projectId: "project-1" }, root: "notes" }],
        },
      ]),
    );

    unsubscribe?.();

    expect(unsubscribeRemote).toHaveBeenCalledTimes(1);
  });

  test("refreshes live entity views when Jazz subscriptions change", async () => {
    const repository = createMemoryRepository();
    let emitRemoteChange: (() => void) | undefined;
    const unsubscribeRemote = vi.fn<() => void>();
    repository.subscribeEntities = vi.fn<NonNullable<typeof repository.subscribeEntities>>(
      (_type, _ids, _select, _args, onChange) => {
        emitRemoteChange = onChange;

        return unsubscribeRemote;
      },
    );
    const transport = createJazzFateTransport<MutationMap>(repository);
    const records: unknown[] = [];
    const unsubscribe = transport.subscribeById?.(
      "Note",
      "note-1",
      new Set(["id", "title"]),
      {},
      {
        onData(record) {
          records.push(record);
        },
      },
    );

    emitRemoteChange?.();

    await vi.waitFor(() =>
      expect(records).toStrictEqual([
        {
          __typename: "Note",
          id: "note-1",
          title: "Roadmap",
        },
      ]),
    );

    unsubscribe?.();

    expect(unsubscribeRemote).toHaveBeenCalledTimes(1);
  });

  test("serializes retained Fate request refreshes for the same client", async () => {
    const handle = createRefreshHandle();
    const client = {
      executeRequestHandle: vi.fn<(requestHandle: typeof handle) => void>((requestHandle) => {
        requestHandle.start();
      }),
      requests: new Map([["notes", new Map([["cache-first", handle]])]]),
    };

    const firstRefresh = refreshJazzFateCache(client, [{ root: "notes" }]);
    await vi.waitFor(() => expect(client.executeRequestHandle).toHaveBeenCalledTimes(1));

    const secondRefresh = refreshJazzFateCache(client, [{ root: "notes" }]);
    await Promise.resolve();

    expect(client.executeRequestHandle).toHaveBeenCalledTimes(1);

    handle.resolveCurrent();
    await vi.waitFor(() => expect(client.executeRequestHandle).toHaveBeenCalledTimes(2));

    handle.resolveCurrent();

    await expect(firstRefresh).resolves.toBe(1);
    await expect(secondRefresh).resolves.toBe(1);
  });

  test("keeps retained Fate list state while revalidating", async () => {
    const handle = createRefreshHandle();
    const store = {
      getListState: vi.fn<(key: string) => { items: string[] }>(() => ({ items: ["cached-note"] })),
      restoreList: vi.fn<(key: string, list?: unknown) => void>(),
    };
    const client = {
      executeRequestHandle: vi.fn<(requestHandle: typeof handle) => void>((requestHandle) => {
        requestHandle.start();
      }),
      requests: new Map([["notes", new Map([["cache-first", handle]])]]),
      store,
    };

    const refresh = refreshJazzFateCache(client, [{ root: "notes" }]);
    await vi.waitFor(() => expect(client.executeRequestHandle).toHaveBeenCalledTimes(1));

    expect(store.getListState).not.toHaveBeenCalled();
    expect(store.restoreList).not.toHaveBeenCalled();

    handle.resolveCurrent();

    await expect(refresh).resolves.toBe(1);
    expect(store.restoreList).not.toHaveBeenCalled();
  });

  test("updates retained scoped Fate lists after local mutations", () => {
    const output = {
      __typename: "Note",
      id: "note-1",
      projectId: "project-1",
      title: "Draft",
    } satisfies NoteEntity;
    const handle = {
      descriptor: {
        items: [
          {
            argsPayload: { projectId: "project-1" },
            kind: "list",
            listKey: "scoped-notes",
            name: "notes",
            type: "Note",
          },
        ],
      },
    };
    const store = {
      getListState: vi.fn<(key: string) => { cursors: string[]; ids: string[] }>(() => ({
        cursors: [],
        ids: [],
      })),
      setList: vi.fn<(key: string, state: { cursors?: string[]; ids: string[] }) => void>(),
    };
    const write = vi.fn<() => void>();
    const client = {
      requests: new Map([["notes", new Map([["cache-first", handle]])]]),
      store,
      write,
    };
    const cacheUpdates: unknown[] = [];
    const unsubscribe = subscribeToJazzFateCacheUpdates(client, (event) => {
      cacheUpdates.push(event);
    });

    expect(
      applyJazzFateMutationToCache(client, {
        affectedLists: [{ args: { projectId: "project-1" }, root: "notes" }],
        operation: "upsert",
        output,
      }),
    ).toBe(1);

    expect(write).toHaveBeenCalledWith(
      "Note",
      output,
      new Set(["id", "projectId", "title"]),
      undefined,
      undefined,
      null,
      null,
      "none",
    );
    expect(store.setList).toHaveBeenCalledWith("scoped-notes", {
      cursors: ["note-1"],
      ids: ["Note:note-1"],
    });
    expect(cacheUpdates).toStrictEqual([
      {
        affectedLists: [{ args: { projectId: "project-1" }, root: "notes" }],
      },
    ]);

    unsubscribe();
  });

  test("removes rejected inserted entities from Fate cache lists", () => {
    const output = {
      __typename: "Note",
      id: "note-1",
      projectId: "project-1",
      title: "Draft",
    } satisfies NoteEntity;
    const handle = {
      descriptor: {
        items: [
          {
            argsPayload: { projectId: "project-1" },
            kind: "list",
            listKey: "scoped-notes",
            name: "notes",
            type: "Note",
          },
        ],
      },
    };
    const store = {
      deleteRecord: vi.fn<(id: string) => void>(),
      getListState: vi.fn<(key: string) => { cursors: string[]; ids: string[] }>(() => ({
        cursors: ["note-1"],
        ids: ["Note:note-1"],
      })),
      setList: vi.fn<(key: string, state: { cursors?: string[]; ids: string[] }) => void>(),
    };
    const client = {
      requests: new Map([["notes", new Map([["cache-first", handle]])]]),
      store,
    };

    expect(
      applyJazzFateSyncRejectionToCache(client, {
        affectedLists: [{ args: { projectId: "project-1" }, root: "notes" }],
        operation: "insert",
        output,
        rollbackOutput: null,
      }),
    ).toBe(1);

    expect(store.deleteRecord).toHaveBeenCalledWith("Note:note-1");
    expect(store.setList).toHaveBeenCalledWith("scoped-notes", {
      cursors: [],
      ids: [],
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

  test("keeps selected optional fields covered when the source row omits them", () => {
    expect(
      projectEntity<NoteEntity>(
        {
          __typename: "Note",
          id: "note-1",
          title: "Roadmap",
        },
        ["id", "body", "privateMemo", "title"],
        ["id", "body", "title"],
      ),
    ).toStrictEqual({
      __typename: "Note",
      body: undefined,
      id: "note-1",
      title: "Roadmap",
    });
  });
});

type NoteRow = {
  body: string;
  createdAt: number;
  id: string;
  privateMemo: string;
  projectId: string;
  title: string;
};

type FakeNoteQueryCall =
  | {
      id: string;
      method: "delete";
    }
  | {
      conditions: Record<string, unknown>;
      method: "where";
    }
  | {
      column: string;
      direction: "asc" | "desc";
      method: "orderBy";
    }
  | {
      columns: string[];
      method: "select";
    }
  | {
      count: number;
      method: "limit" | "offset";
    }
  | {
      data: Partial<NoteRow>;
      id: string;
      method: "update" | "upsert";
    };

class FakeNoteQuery {
  readonly calls: FakeNoteQueryCall[] = [];
  private conditions: Record<string, unknown> | undefined;
  private limitCount: number | undefined;
  private offsetCount = 0;
  private order: { column: keyof NoteRow; direction: "asc" | "desc" } | undefined;
  private selectedColumns: string[] | undefined;

  constructor(private readonly rows: NoteRow[]) {}

  where(conditions: Record<string, unknown>) {
    this.conditions = conditions;
    this.calls.push({
      conditions,
      method: "where",
    });

    return this;
  }

  orderBy(column: string, direction: "asc" | "desc") {
    this.order = {
      column: column as keyof NoteRow,
      direction,
    };
    this.calls.push({
      column,
      direction,
      method: "orderBy",
    });

    return this;
  }

  select(...columns: [string, ...string[]]) {
    this.selectedColumns = columns;
    this.calls.push({
      columns,
      method: "select",
    });

    return this;
  }

  offset(count: number) {
    this.offsetCount = count;
    this.calls.push({
      count,
      method: "offset",
    });

    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    this.calls.push({
      count,
      method: "limit",
    });

    return this;
  }

  upsert(id: string, data: Partial<NoteRow>) {
    const index = this.rows.findIndex((row) => row.id === id);
    const row: NoteRow = {
      body: "",
      createdAt: 0,
      id,
      privateMemo: "",
      projectId: "",
      title: "",
      ...(index >= 0 ? this.rows[index] : undefined),
      ...data,
    };

    if (index >= 0) {
      this.rows.splice(index, 1, row);
    } else {
      this.rows.push(row);
    }

    this.calls.push({
      data,
      id,
      method: "upsert",
    });

    return row;
  }

  update(id: string, data: Partial<NoteRow>) {
    const row = this.upsert(id, data);
    const lastCall = this.calls.at(-1);

    if (lastCall?.method === "upsert") {
      lastCall.method = "update";
    }

    return row;
  }

  delete(id: string) {
    const index = this.rows.findIndex((row) => row.id === id);

    if (index >= 0) {
      this.rows.splice(index, 1);
    }

    this.calls.push({
      id,
      method: "delete",
    });
  }

  find(id: string) {
    return this.rows.find((row) => row.id === id);
  }

  execute() {
    let rows = this.rows.filter((row) => {
      if (!this.conditions) {
        return true;
      }

      return Object.entries(this.conditions).every(
        ([key, value]) => row[key as keyof NoteRow] === value,
      );
    });

    if (this.order) {
      const { column, direction } = this.order;
      const multiplier = direction === "asc" ? 1 : -1;

      rows = [...rows].sort((left, right) => {
        if (left[column] === right[column]) {
          return 0;
        }

        return left[column] < right[column] ? -1 * multiplier : multiplier;
      });
    }

    rows = rows.slice(this.offsetCount);

    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows.map((row) => {
      if (!this.selectedColumns) {
        return row;
      }

      const selected: Record<string, unknown> = {};

      for (const column of this.selectedColumns) {
        selected[column] = row[column as keyof NoteRow];
      }

      return selected;
    });
  }
}

function createNoteRow(id: string, projectId: string, title: string, createdAt: number): NoteRow {
  return {
    body: `${title} body`,
    createdAt,
    id,
    privateMemo: `${title} private memo`,
    projectId,
    title,
  };
}

function createFakeNoteDb(
  table: FakeNoteQuery,
  dbOptions: {
    updateValue?: unknown;
    wait?: (options: { tier: "edge" | "local" }) => Promise<void>;
  } = {},
): JazzFateDb {
  return {
    async all(query: unknown) {
      return (query as FakeNoteQuery).execute();
    },
    insert(_table: unknown, _input: unknown) {
      throw new Error("insert is not used by this test");
    },
    async one(query: unknown) {
      return (query as FakeNoteQuery).execute().at(0) ?? null;
    },
    delete(_table: unknown, id: string) {
      table.delete(id);

      return {
        wait: dbOptions.wait ?? (async () => {}),
      };
    },
    update(_table: unknown, _id: string, _input: unknown) {
      table.update(_id, _input as Partial<NoteRow>);

      return {
        value: dbOptions.updateValue,
        wait: dbOptions.wait ?? (async () => {}),
      };
    },
    upsert(_table: unknown, input: unknown, options: { id: string }) {
      table.upsert(options.id, input as Partial<NoteRow>);

      return {
        wait: dbOptions.wait ?? (async () => {}),
      };
    },
  } as unknown as JazzFateDb;
}

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

    getAffectedLists() {
      return [{ root: "notes" }];
    },
  };

  return repository;
}

function createRefreshHandle() {
  let current: Promise<void> | null = null;
  let resolve: (() => void) | null = null;

  return {
    descriptor: {
      items: [
        {
          argsPayload: {},
          kind: "list",
          name: "notes",
        },
      ],
    },
    resolveCurrent() {
      resolve?.();
    },
    start() {
      current = new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      });
    },
    then(onFulfilled: () => unknown, onRejected?: (error: unknown) => unknown) {
      if (!current) {
        return Promise.reject(new Error("Refresh handle was not started")).then(
          onFulfilled,
          onRejected,
        );
      }

      return current.then(onFulfilled, onRejected);
    },
  };
}
