import { Hono } from "hono";
import { createAuth } from "../auth";
import type { ApiHonoEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";

export interface CloudUserSettings {
  autoOpenCalculator: boolean;
  hue: number;
  locale: "en" | "es" | null;
  openLastPartyOnLaunch: boolean;
  phone: string;
  updatedAt: number;
  username: string;
}

interface CloudUserSettingsRow {
  autoOpenCalculator: number;
  hue: number;
  locale: string | null;
  openLastPartyOnLaunch: number;
  phone: string;
  updatedAt: number;
  username: string;
}

const supportedLocales = new Set(["en", "es"]);
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
  const row = await c.env.DB.prepare(
    `select username, phone, locale, openLastPartyOnLaunch, autoOpenCalculator, hue, updatedAt
      from cloud_user_settings
      where userId = ?`,
  )
    .bind(user.id)
    .first<CloudUserSettingsRow>();

  return c.json({
    settings: row ? serializeCloudUserSettings(row) : null,
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

  await c.env.DB.prepare(
    `insert into cloud_user_settings (
        userId,
        username,
        phone,
        locale,
        openLastPartyOnLaunch,
        autoOpenCalculator,
        hue,
        updatedAt
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(userId) do update set
        username = excluded.username,
        phone = excluded.phone,
        locale = excluded.locale,
        openLastPartyOnLaunch = excluded.openLastPartyOnLaunch,
        autoOpenCalculator = excluded.autoOpenCalculator,
        hue = excluded.hue,
        updatedAt = excluded.updatedAt`,
  )
    .bind(
      user.id,
      settings.username,
      settings.phone,
      settings.locale,
      settings.openLastPartyOnLaunch ? 1 : 0,
      settings.autoOpenCalculator ? 1 : 0,
      settings.hue,
      settings.updatedAt,
    )
    .run();

  logger.info("Saved cloud user settings", {
    userId: user.id,
  });

  return c.json({
    settings,
  });
});

function serializeCloudUserSettings(row: CloudUserSettingsRow): CloudUserSettings {
  return {
    autoOpenCalculator: row.autoOpenCalculator === 1,
    hue: row.hue,
    locale: row.locale === "en" || row.locale === "es" ? row.locale : null,
    openLastPartyOnLaunch: row.openLastPartyOnLaunch === 1,
    phone: row.phone,
    updatedAt: row.updatedAt,
    username: row.username,
  };
}

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

  if (typeof candidate.username !== "string") {
    return { error: "Username must be a string.", ok: false };
  }

  if (typeof candidate.phone !== "string") {
    return { error: "Phone must be a string.", ok: false };
  }

  if (
    candidate.locale !== null &&
    candidate.locale !== undefined &&
    (typeof candidate.locale !== "string" || !supportedLocales.has(candidate.locale))
  ) {
    return { error: "Locale is not supported.", ok: false };
  }

  if (typeof candidate.openLastPartyOnLaunch !== "boolean") {
    return { error: "Open last party on launch must be a boolean.", ok: false };
  }

  if (typeof candidate.autoOpenCalculator !== "boolean") {
    return { error: "Auto-open calculator must be a boolean.", ok: false };
  }

  if (
    typeof candidate.hue !== "number" ||
    !Number.isFinite(candidate.hue) ||
    candidate.hue < 0 ||
    candidate.hue > 360
  ) {
    return { error: "Accent color hue is invalid.", ok: false };
  }

  return {
    ok: true,
    value: {
      autoOpenCalculator: candidate.autoOpenCalculator,
      hue: candidate.hue,
      locale: candidate.locale ? (candidate.locale as "en" | "es") : null,
      openLastPartyOnLaunch: candidate.openLastPartyOnLaunch,
      phone: candidate.phone,
      username: candidate.username,
    },
  };
}
