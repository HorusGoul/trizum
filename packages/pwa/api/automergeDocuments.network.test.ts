import { once } from "node:events";
import { createRequire } from "node:module";
import { generateAutomergeUrl, parseAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type * as WebSocketModule from "ws" with { "resolution-mode": "require" };
import type { WebSocketServer } from "ws" with { "resolution-mode": "require" };

import { Hono } from "hono";
import type { ApiEnv, ApiHonoEnv } from "./env";
import { createApiI18nMiddleware } from "./i18n";
import { createPartySharePreviewRoute } from "./routes/party-share-preview";
import { verifyPartyMembership } from "./premium/partyMembership";

import { AutomergeDocuments } from "./automergeDocuments";

import { createAutomergeDocumentsMiddleware } from "./automergeDocumentsMiddleware";

// Match the server adapter's CommonJS ws export and bypass the browser alias.
const WebSocket = createRequire(import.meta.url)("ws") as typeof WebSocketModule;

describe("Worker document reads over WebSocket", () => {
  let server: Repo | undefined;
  let sockets: WebSocketServer | undefined;

  afterEach(async () => {
    await server?.shutdown();
    server = undefined;
    await new Promise<void>((resolve, reject) => {
      if (!sockets) return resolve();
      sockets.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each([0, 1500])(
    "loads membership and previews with a %i ms WebSocket handshake",
    async (delay) => {
      const env = await startServer(delay);
      const party = server!.create({
        type: "party",
        id: "",
        name: "Handshake regression party",
        participants: { member: { id: "member", name: "Member" } },
      });
      party.change((doc) => {
        doc.id = party.documentId;
      });
      const list = server!.create({
        type: "partyList",
        parties: { [party.documentId]: true },
        participantInParties: { [party.documentId]: "member" },
      });

      const documents = new AutomergeDocuments({
        env,
        request: new Request("https://trizum.example.test"),
      });
      try {
        await expect(
          verifyPartyMembership({
            documents,
            partyDocumentId: party.documentId,
            partyListDocumentId: list.documentId,
          }),
        ).resolves.toBe(true);
      } finally {
        await documents.close();
      }

      const app = new Hono<ApiHonoEnv>();
      app.use("*", createApiI18nMiddleware());
      app.route("/", createPartySharePreviewRoute());
      const response = await app.request(
        `https://trizum.example.test/party/${party.documentId}?preview=1`,
        {},
        env,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Handshake regression party");
      await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
    },
  );

  it("shares one lazy repo across concurrent and sequential reads, then isolates the next request", async () => {
    const env = await startServer();
    const first = server!.create({ name: "First" });
    const second = server!.create({ name: "Second" });
    const third = server!.create({ name: "Third" });
    const connections = vi.fn<() => void>();
    sockets!.on("connection", connections);
    const app = new Hono<ApiHonoEnv>();
    app.use("*", createAutomergeDocumentsMiddleware());
    app.use("*", createAutomergeDocumentsMiddleware());
    app.get("/", async (c) => {
      const documents = c.get("documents");
      const pair = await Promise.all([
        documents.read<{ name: string }>(first.documentId),
        documents.read<{ name: string }>(second.documentId),
      ]);
      const later = await documents.read<{ name: string }>(third.documentId);
      const again = await documents.read<{ name: string }>(first.documentId);
      return c.json([...pair.map((doc) => doc.name), later.name, again.name]);
    });
    for (let request = 1; request <= 2; request++) {
      const response = await app.request("https://trizum.example.test", {}, env);
      expect(await response.json()).toEqual(["First", "Second", "Third", "First"]);
      expect(connections).toHaveBeenCalledTimes(request);
      await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
    }
  });

  it("closes the shared repo when a downstream handler fails", async () => {
    const env = await startServer();
    const party = server!.create({ name: "Party" });
    const app = new Hono<ApiHonoEnv>();
    app.use("*", createAutomergeDocumentsMiddleware());
    app.onError((_error, c) => c.text("Expected failure", 500));
    app.get("/", async (c) => {
      await c.get("documents").read(party.documentId);
      throw new Error("Handler failed");
    });
    const response = await app.request("https://trizum.example.test", {}, env);
    expect(response.status).toBe(500);
    await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
  });

  it.each(["timeout", "request abort"])(
    "closes a connection that never advertises a sync peer on %s",
    async (reason) => {
      const env = await startServer(0, false);
      const controller = new AbortController();
      // The client's join proves it has processed the HTTP upgrade too.
      const connected = once(sockets!, "connection").then(([socket]) => once(socket, "message"));
      const documents = new AutomergeDocuments({
        env,
        request: new Request("https://trizum.example.test", { signal: controller.signal }),
        timeoutMs: reason === "timeout" ? "200" : "5000",
      });
      const reading = documents.read(parseAutomergeUrl(generateAutomergeUrl()).documentId);
      try {
        await Promise.all([
          expect(reading).rejects.toMatchObject({ name: "AbortError" }),
          connected.then(() => {
            if (reason === "request abort") controller.abort();
          }),
        ]);
      } finally {
        await documents.close();
      }
      await vi.waitFor(() => expect(sockets!.clients.size).toBe(0));
    },
  );

  async function startServer(delay = 0, sync = true) {
    sockets = new WebSocket.Server({
      port: 0,
      verifyClient: (_info, done) => {
        setTimeout(() => done(true), delay);
      },
    });
    if (sync) {
      server = new Repo({
        network: [new NodeWSServerAdapter(sockets)],
        sharePolicy: async () => false,
      });
    }
    await once(sockets, "listening");
    const address = sockets.address();
    if (!address || typeof address === "string") throw new Error("Expected a local TCP server");
    return {
      AUTOMERGE_WSS_URL: `ws://127.0.0.1:${address.port}`,
      PARTY_MEMBERSHIP_TIMEOUT_MS: "5000",
      PARTY_SHARE_PREVIEW_TIMEOUT_MS: "5000",
      ASSETS: {
        fetch: async () =>
          new Response("<html><head><title>Fallback</title></head><body></body></html>"),
      },
    } as unknown as ApiEnv;
  }
});
