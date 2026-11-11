import { createHmac, randomBytes } from "node:crypto";
import type { DocumentId, Repo } from "@automerge/automerge-repo/slim";
import type { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import type WebSocket from "isomorphic-ws";
import { rootLogger as logger } from "./log.ts";

const correlationKey = randomBytes(32);

// Correlate activity within one process without exposing document access tokens.
export function diagnosticRef(value: string): string {
  return createHmac("sha256", correlationKey).update(value).digest("hex").slice(0, 16);
}

export function observeSync(
  server: WebSocket.Server,
  adapter: NodeWSServerAdapter,
  repo: Repo,
): void {
  const connections = new WeakMap<WebSocket, string>();
  const documents = new WeakMap<WebSocket, Set<DocumentId>>();

  server.on("connection", (socket) => {
    const connectionRef = crypto.randomUUID();
    connections.set(socket, connectionRef);
    documents.set(socket, new Set());
    const started = performance.now();
    let messageCount = 0;
    let receivedBytes = 0;
    let largestMessageBytes = 0;

    logger.info("Sync connection opened {connectionRef}", { connectionRef });
    socket.on("message", (data) => {
      const bytes = Array.isArray(data)
        ? data.reduce((sum, part) => sum + part.byteLength, 0)
        : data.byteLength;

      messageCount++;
      receivedBytes += bytes;
      largestMessageBytes = Math.max(largestMessageBytes, bytes);
    });
    socket.on("close", (closeCode, reason) => {
      logger.info("Sync connection closed {connectionRef} with code {closeCode}", {
        connectionRef,
        closeCode,
        reasonBytes: reason.byteLength,
        durationMs: Math.round(performance.now() - started),
        messageCount,
        receivedBytes,
        largestMessageBytes,
        bufferedBytes: socket.bufferedAmount,
        activeConnections: server.clients.size,
        rssBytes: process.memoryUsage().rss,
        recentDocuments: [...(documents.get(socket) ?? [])].map((id) => ({
          documentRef: diagnosticRef(id),
          state: repo.handles[id]?.state ?? "unknown",
        })),
      });
    });
    socket.on("error", (error) => {
      logger.error("Sync socket failed {connectionRef}: {error}", { connectionRef, error });
    });
  });

  adapter.on("message", (message) => {
    if (!message.documentId) return;

    const socket = adapter.sockets[message.senderId];
    const recent = socket ? documents.get(socket) : undefined;

    if (recent) {
      recent.delete(message.documentId);
      recent.add(message.documentId);

      if (recent.size > 16) recent.delete(recent.values().next().value!);
    }

    const fields = {
      connectionRef: socket ? connections.get(socket) : undefined,
      documentRef: diagnosticRef(message.documentId),
      messageType: message.type,
      state: repo.handles[message.documentId]?.state ?? "unknown",
      bytes: "data" in message ? (message.data?.byteLength ?? 0) : 0,
    };

    if (fields.bytes >= 64 * 1024) {
      logger.info("Large sync message received for {documentRef}: {bytes} bytes", {
        ...fields,
        rssBytes: process.memoryUsage().rss,
      });
    } else {
      logger.debug("Sync message received", fields);
    }
  });

  repo.on("doc-metrics", (metric) => {
    if (!("durationMillis" in metric)) return;

    const fields = {
      documentRef: diagnosticRef(metric.documentId),
      operation: metric.type,
      durationMs: Math.round(metric.durationMillis),
      numOps: "numOps" in metric ? metric.numOps : undefined,
      numChanges: "numChanges" in metric ? metric.numChanges : undefined,
    };

    if (metric.durationMillis >= 1000) {
      logger.warning(
        "Slow Automerge operation {operation} for {documentRef}: {durationMs}ms",
        fields,
      );
    } else {
      logger.debug("Automerge operation completed", fields);
    }
  });
}
