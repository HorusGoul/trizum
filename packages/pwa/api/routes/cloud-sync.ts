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
import type { ApiHonoEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";

const logger = getLogger("api", "cloudSync");

const cloudSyncApp = $(
  new OpenAPIHono<ApiHonoEnv>().use("*", async (c, next) => {
    const auth = createAuth(c.env, c.executionCtx, c.req.raw);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("session", session.session);
    c.set("user", session.user);

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

export const cloudSyncRoute = cloudSyncApp
  .openapi(getCloudUserSettingsRoute, async (c) => {
    const user = c.get("user");
    const db = getApiDb(c.env.DB);
    const [settings] = await db
      .select({
        partyListDocumentId: schema.cloudUserSettings.partyListDocumentId,
        updatedAt: schema.cloudUserSettings.updatedAt,
      })
      .from(schema.cloudUserSettings)
      .where(eq(schema.cloudUserSettings.userId, user.id))
      .limit(1);

    return c.json(getCloudUserSettingsResponseSchema.parse({ settings: settings ?? null }), 200);
  })
  .openapi(
    saveCloudUserSettingsRoute,
    async (c) => {
      const user = c.get("user");
      const settings = {
        ...c.req.valid("json"),
        updatedAt: Date.now(),
      };
      const db = getApiDb(c.env.DB);
      const [existingSettings] = await db
        .select({
          partyListDocumentId: schema.cloudUserSettings.partyListDocumentId,
          updatedAt: schema.cloudUserSettings.updatedAt,
        })
        .from(schema.cloudUserSettings)
        .where(eq(schema.cloudUserSettings.userId, user.id))
        .limit(1);

      if (existingSettings) {
        if (existingSettings.partyListDocumentId !== settings.partyListDocumentId) {
          logger.warning("Rejected cloud user settings document change", {
            userId: user.id,
          });

          return c.json({ error: "trizum cloud is already set up for this account." }, 409);
        }

        return c.json(
          saveCloudUserSettingsResponseSchema.parse({ settings: existingSettings }),
          200,
        );
      }

      await db
        .insert(schema.cloudUserSettings)
        .values({
          partyListDocumentId: settings.partyListDocumentId,
          updatedAt: settings.updatedAt,
          userId: user.id,
        })
        .onConflictDoNothing({
          target: schema.cloudUserSettings.userId,
        });

      const [storedSettings] = await db
        .select({
          partyListDocumentId: schema.cloudUserSettings.partyListDocumentId,
          updatedAt: schema.cloudUserSettings.updatedAt,
        })
        .from(schema.cloudUserSettings)
        .where(eq(schema.cloudUserSettings.userId, user.id))
        .limit(1);

      if (!storedSettings) {
        logger.error("Could not read cloud user settings after insert", {
          userId: user.id,
        });

        return c.json({ error: "Could not save trizum cloud settings." }, 500);
      }

      if (storedSettings.partyListDocumentId !== settings.partyListDocumentId) {
        logger.warning("Rejected cloud user settings document change", {
          userId: user.id,
        });

        return c.json({ error: "trizum cloud is already set up for this account." }, 409);
      }

      logger.info("Saved cloud user settings", {
        userId: user.id,
      });

      return c.json(saveCloudUserSettingsResponseSchema.parse({ settings: storedSettings }), 200);
    },
    (result, c) => {
      if (!result.success) {
        return c.req.json<unknown>().then((body) => {
          const isObject = body !== null && typeof body === "object";
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

export type CloudSyncRoute = typeof cloudSyncRoute;
