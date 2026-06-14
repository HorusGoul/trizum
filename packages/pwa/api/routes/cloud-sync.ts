import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createAuth } from "../auth";
import { getApiDb, schema } from "../db/client";
import type { ApiHonoEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";

export interface CloudUserSettings {
  partyListDocumentId: string;
  updatedAt: number;
}

const logger = getLogger("api", "cloudSync");

export const cloudSyncRoute = new Hono<ApiHonoEnv>();

cloudSyncRoute.use("*", async (c, next) => {
  const auth = createAuth(c.env, c.executionCtx, c.req.raw);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session.session);
  c.set("user", session.user);

  await next();
});

cloudSyncRoute.get("/settings", async (c) => {
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

  return c.json({
    settings: settings ?? null,
  });
});

cloudSyncRoute.put("/settings", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsedSettings = parseCloudUserSettingsInput(body);

  if (!parsedSettings.ok) {
    return c.json({ error: parsedSettings.error }, 400);
  }

  const settings = {
    ...parsedSettings.value,
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

    return c.json({
      settings: existingSettings,
    });
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
    partyListDocumentId: storedSettings.partyListDocumentId,
    userId: user.id,
  });

  return c.json({
    settings: storedSettings,
  });
});

function parseCloudUserSettingsInput(value: unknown):
  | {
      ok: true;
      value: Omit<CloudUserSettings, "updatedAt">;
    }
  | {
      error: string;
      ok: false;
    } {
  if (!value || typeof value !== "object") {
    return { error: "Expected a settings object.", ok: false };
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.partyListDocumentId !== "string" ||
    !isValidDocumentId(candidate.partyListDocumentId)
  ) {
    return { error: "Party list document ID is invalid.", ok: false };
  }

  return {
    ok: true,
    value: {
      partyListDocumentId: candidate.partyListDocumentId,
    },
  };
}
