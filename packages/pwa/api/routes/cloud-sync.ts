import { z } from "zod";
import { $, OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { getCloudUserSettingsRoute, saveCloudUserSettingsRoute } from "../contracts/cloud-sync";
import {
  getCloudUserSettingsResponseSchema,
  saveCloudUserSettingsResponseSchema,
} from "../../src/lib/api/cloudSyncContract";
import { eq } from "drizzle-orm";
import { createAuth } from "../auth";
import { getApiDb, schema } from "../db/client";
import type { ApiEnv, ApiHonoEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";

const logger = getLogger("api", "cloudSync");

interface CloudSettings {
  partyListDocumentId: string;
  updatedAt: number;
}

export interface CloudSettingsStore {
  read(userId: string): Promise<CloudSettings | undefined>;
  insertIfMissing(settings: CloudSettings & { userId: string }): Promise<void>;
}

export function createCloudSettingsStore(db: ReturnType<typeof getApiDb>): CloudSettingsStore {
  return {
    async read(userId) {
      const [settings] = await db
        .select({
          partyListDocumentId: schema.cloudUserSettings.partyListDocumentId,
          updatedAt: schema.cloudUserSettings.updatedAt,
        })
        .from(schema.cloudUserSettings)
        .where(eq(schema.cloudUserSettings.userId, userId))
        .limit(1);

      return settings;
    },
    async insertIfMissing(settings) {
      await db
        .insert(schema.cloudUserSettings)
        .values(settings)
        .onConflictDoNothing({ target: schema.cloudUserSettings.userId });
    },
  };
}

type CloudSyncEnv = ApiHonoEnv & { Variables: { cloudUserId: string } };

export function createCloudSyncRoute({
  authenticate = async (
    env: ApiEnv,
    context: Pick<ExecutionContext, "waitUntil">,
    request: Request,
  ) => {
    const session = await createAuth(env, context, request).api.getSession({
      headers: request.headers,
    });

    return session?.user.id ?? null;
  },
  settingsStore = (env: ApiEnv) => createCloudSettingsStore(getApiDb(env.DB)),
}: {
  authenticate?: (
    env: ApiEnv,
    context: Pick<ExecutionContext, "waitUntil">,
    request: Request,
  ) => Promise<string | null>;
  settingsStore?: (env: ApiEnv) => CloudSettingsStore;
} = {}) {
  const cloudSyncApp = $(
    new OpenAPIHono<CloudSyncEnv>().use("*", async (c, next) => {
      const userId = await authenticate(c.env, c.executionCtx, c.req.raw);

      if (!userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      c.set("cloudUserId", userId);

      // The existing endpoint reads JSON regardless of Content-Type. Preserve that
      // behavior before OpenAPI's media-type gate and JSON validator run.
      if (c.req.method === "PUT") {
        const headers = new Headers(c.req.raw.headers);
        headers.set("Content-Type", "application/json");
        c.req.raw = new Request(c.req.raw, { headers });
      }

      await next();
    }),
  );

  cloudSyncApp.onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400) {
      return c.json({ error: "Expected a settings object." }, 400);
    }

    logger.error("Cloud Sync settings request failed", { error });

    return c.json(
      {
        error:
          c.req.method === "PUT"
            ? "Could not save trizum cloud settings."
            : "Failed to load trizum cloud settings.",
      },
      500,
    );
  });

  const cloudSyncRoute = cloudSyncApp
    .openapi(getCloudUserSettingsRoute, async (c) => {
      const userId = c.get("cloudUserId");
      const store = settingsStore(c.env);

      const settings = await store.read(userId);

      return c.json(getCloudUserSettingsResponseSchema.parse({ settings: settings ?? null }), 200);
    })
    .openapi(
      saveCloudUserSettingsRoute,
      async (c) => {
        const userId = c.get("cloudUserId");

        const settings = {
          ...c.req.valid("json"),
          updatedAt: Date.now(),
        };

        const store = settingsStore(c.env);

        const existingSettings = await store.read(userId);

        if (existingSettings) {
          if (existingSettings.partyListDocumentId !== settings.partyListDocumentId) {
            logger.warning("Rejected cloud user settings document change", {
              userId: userId,
            });

            return c.json({ error: "trizum cloud is already set up for this account." }, 409);
          }

          return c.json(
            saveCloudUserSettingsResponseSchema.parse({ settings: existingSettings }),
            200,
          );
        }

        await store.insertIfMissing({
          partyListDocumentId: settings.partyListDocumentId,
          updatedAt: settings.updatedAt,
          userId,
        });

        const storedSettings = await store.read(userId);

        if (!storedSettings) {
          logger.error("Could not read cloud user settings after insert", {
            userId: userId,
          });

          return c.json({ error: "Could not save trizum cloud settings." }, 500);
        }

        if (storedSettings.partyListDocumentId !== settings.partyListDocumentId) {
          logger.warning("Rejected cloud user settings document change", {
            userId: userId,
          });

          return c.json({ error: "trizum cloud is already set up for this account." }, 409);
        }

        logger.info("Saved cloud user settings", {
          userId: userId,
        });

        return c.json(saveCloudUserSettingsResponseSchema.parse({ settings: storedSettings }), 200);
      },
      (result, c) => {
        if (!result.success) {
          return c.req.json<unknown>().then((body) => {
            const isObject = settingsContainerSchema.safeParse(body).success;

            return c.json(
              {
                error: isObject
                  ? "Party list document ID is invalid."
                  : "Expected a settings object.",
              },
              400,
            );
          });
        }
      },
    );

  return cloudSyncRoute;
}

export const cloudSyncRoute = createCloudSyncRoute();

export type CloudSyncRoute = typeof cloudSyncRoute;

const settingsContainerSchema = z.union([z.object({}), z.array(z.unknown())]);
