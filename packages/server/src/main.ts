import { env } from "#src/env.ts";
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import { initializeBase64Wasm, Repo, type PeerId } from "@automerge/automerge-repo/slim";
import { DrizzleSqliteStorageAdapter } from "./repo/DrizzleSqliteStorageAdapter.ts";
import { db } from "./db.ts";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import * as os from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { serve, type ServerType, upgradeWebSocket } from "@hono/node-server";
import { configureServerLogging, rootLogger as logger } from "./log.ts";
import { withContext } from "@logtape/logtape";
import { cors } from "hono/cors";
import { fileURLToPath } from "node:url";
import WebSocket from "isomorphic-ws";

configureServerLogging();

let automergeWasm: Promise<void> | undefined;

function initializeAutomerge() {
  automergeWasm ??= initializeBase64Wasm(automergeWasmBase64);
  return automergeWasm;
}

export async function startServer() {
  logger.info("Starting server with version {version}...");
  await initializeAutomerge();

  const app = new Hono({});
  const webSocketServer = new WebSocket.Server({ noServer: true });

  const hostname = os.hostname();
  const repo = new Repo({
    storage: new DrizzleSqliteStorageAdapter(db),
    network: [new NodeWSServerAdapter(webSocketServer)],

    // TODO: supporting multiple servers or processes isn't supported yet
    peerId: `server:${hostname}` as PeerId,
    sharePolicy: () => Promise.resolve(false),
  });

  const storageId = await repo.storageId().catch(() => {
    logger.error(
      "Failed to get Automerge Storage ID, this could be related to not having ran migrations for the database.",
    );
    process.exit(1);
  });
  logger.info("Automerge storage ID", { storageId });

  // Request logging middleware
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    await withContext(
      {
        requestId,
        method: c.req.method,
        url: c.req.url,
        userAgent: c.req.header("User-Agent"),
        ipAddress: c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For"),
      },
      async () => {
        logger.info("Request started", {
          method: c.req.method,
          url: c.req.url,
          requestId,
        });

        await next();

        const duration = Date.now() - startTime;
        logger.info("Request completed", {
          status: c.res.status,
          duration,
          requestId,
        });
      },
    );
  });

  // CORS middleware
  app.use(
    "*",
    cors({
      origin:
        env.NODE_ENV === "production"
          ? [
              "https://trizum.app",
              "https://web.trizum.app",
              "https://server.trizum.app",
              "https://*.horusdev.workers.dev",
            ]
          : "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 86400,
    }),
  );

  app.get(
    "/sync",
    upgradeWebSocket(() => ({
      onOpen: () => {
        logger.info("WebSocket connection opened");
      },
      onClose: () => {
        logger.info("WebSocket connection closed");
      },
      onError: (error) => {
        logger.error("WebSocket connection error", { error });
      },
    })),
  );

  app.get("/health", async (c) => {
    const automerge = await repo
      .storageId()
      .then(() => ({ ok: true }))
      .catch(() => ({ ok: false }));

    return c.json(
      {
        http: {
          ok: true,
        },
        automerge,
      },
      200,
    );
  });

  // Error handling middleware
  app.onError((err, c) => {
    logger.error("Request error", {
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      method: c.req.method,
      url: c.req.url,
    });

    return c.json({ error: "Internal server error" }, 500);
  });

  const port = parseInt(env.PORT);
  const _server = await new Promise<ServerType>((resolve) => {
    const server = serve(
      {
        fetch: app.fetch,
        websocket: { server: webSocketServer },
        port,
        hostname: "0.0.0.0",
      },
      () => resolve(server),
    );

    process.on("SIGINT", () => {
      logger.info("SIGINT received, server is shutting down...");
      server.close();
      void repo.shutdown();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.info("SIGTERM received, server is shutting down...");
      void repo.shutdown();
      server.close((err) => {
        if (err) {
          logger.error(err.message);
          process.exit(1);
        }
        process.exit(0);
      });
    });
  });

  logger.info(`Server is running on 0.0.0.0:${port}`);
}

function isSourceEntrypoint() {
  if (!process.argv[1]) {
    return false;
  }

  const modulePath = fileURLToPath(import.meta.url);
  return (
    modulePath.endsWith(`${path.sep}src${path.sep}main.ts`) &&
    path.resolve(process.argv[1]) === modulePath
  );
}

if (isSourceEntrypoint()) {
  startServer().catch((error) => {
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
