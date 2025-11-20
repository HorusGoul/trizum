import { env } from "#src/env.ts";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { DrizzleSqliteStorageAdapter } from "./repo/DrizzleSqliteStorageAdapter.ts";
import { db } from "./db.ts";
import { NodeWSServerAdapter } from "@automerge/automerge-repo-network-websocket";
import * as os from "node:os";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { rootLogger as logger  } from "./log.ts";


async function main() {
  logger.info("Starting server...");

  const app = new Hono({});
  const webSockets = createNodeWebSocket({
    app,
  });

  const hostname = os.hostname();
  const repo = new Repo({
    storage: new DrizzleSqliteStorageAdapter(db),
    network: [
      // @ts-expect-error - This is fine
      new NodeWSServerAdapter(webSockets.wss),
    ],

    // TODO: supporting multiple servers or processes isn't supported yet
    peerId: `server:${hostname}` as PeerId,
    sharePolicy: () => Promise.resolve(false),
  });

  const storageId = await repo.storageId().catch(() => {
    logger.error("Failed to get Automerge Storage ID, this could be related to not having ran migrations for the database.");
    process.exit(1);
  });
  logger.info("Automerge storage ID", { storageId });

  app.get(
    "/sync",
    webSockets.upgradeWebSocket((c) => ({
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

  const port = parseInt(env.PORT);
  const server = await new Promise<ServerType>((resolve) => {
    const server = serve(
      {
        ...app,
        port,
        hostname: "0.0.0.0",
      },
      () => resolve(server),
    );
    webSockets.injectWebSocket(server);

    process.on("SIGINT", () => {
      logger.info("SIGINT received, server is shutting down...");
      server.close();
      repo.shutdown();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      logger.info("SIGTERM received, server is shutting down...");
      repo.shutdown();
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

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
