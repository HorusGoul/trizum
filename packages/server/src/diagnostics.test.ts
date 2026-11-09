import { configureTrizumLogging } from "@trizum/logging";
import { resetSync, type LogRecord } from "@logtape/logtape";
import { Repo } from "@automerge/automerge-repo";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import WebSocket from "isomorphic-ws";
import { once } from "node:events";
import { afterEach, expect, test } from "vite-plus/test";
import { diagnosticRef, observeSync } from "./diagnostics.ts";

afterEach(() => resetSync());

test("records socket sizes and close codes without recording payloads or document tokens", async () => {
  const records: LogRecord[] = [];
  configureTrizumLogging({
    surface: "server",
    lowestLevel: "debug",
    extraSinks: {
      recording: (record) => {
        records.push(record);
      },
    },
    surfaceSinks: ["recording"],
    reset: true,
  });
  const server = new WebSocket.Server({ port: 0, host: "127.0.0.1" });
  const adapter = new NodeWSServerAdapter(server);
  const repo = new Repo();
  observeSync(server, adapter, repo);
  await once(server, "listening");
  const address = server.address();

  if (!(address instanceof Object)) throw new Error("Expected TCP address");

  const connected = once(server, "connection");
  const client = new WebSocket(`ws://127.0.0.1:${address.port}`);

  try {
    await once(client, "open");
    const [socket] = await connected;
    const received = once(socket, "message");
    const payload = Buffer.alloc(70_000, 97);
    client.send(payload);
    await received;
    adapter.sockets[repo.peerId] = socket;
    const document = repo.create({ secret: "private receipt" });
    adapter.emit("message", {
      type: "sync",
      senderId: repo.peerId,
      targetId: repo.peerId,
      documentId: document.documentId,
      data: payload,
    });
    const closed = once(socket, "close");
    client.close(1000, "private close reason");
    await closed;
    const closeRecord = records.find((record) => record.properties.closeCode === 1000);
    expect(closeRecord?.properties).toMatchObject({
      messageCount: 1,
      receivedBytes: 70_000,
      largestMessageBytes: 70_000,
      recentDocuments: [{ documentRef: diagnosticRef(document.documentId), state: "ready" }],
    });
    expect(
      records.some(
        (record) => record.properties.documentRef === diagnosticRef(document.documentId),
      ),
    ).toBe(true);
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain(document.documentId);
    expect(serialized).not.toContain("private receipt");
    expect(serialized).not.toContain("private close reason");
    expect(serialized).not.toContain("aaaaaa");
  } finally {
    client.terminate();
    await repo.shutdown();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
