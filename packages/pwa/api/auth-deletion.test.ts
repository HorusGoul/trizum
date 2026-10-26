import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type * as DbClient from "./db/client";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createAuth } from "./auth";
import type { ApiEnv } from "./env";
import * as schema from "./db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("./db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof DbClient>()),
  getApiDb: () => state.db,
}));
vi.mock("cloudflare:email", () => ({ EmailMessage: class {} }));

let sqlite: DatabaseSync;
const fetcher = vi.fn<typeof fetch>();
const env = {
  BETTER_AUTH_SECRET: "test-account-deletion-secret-at-least-32-characters",
  REVENUECAT_PROJECT_ID: "test-project",
  REVENUECAT_SECRET_API_KEY: "test-secret",
} as ApiEnv;

function authRequest(
  body: Record<string, unknown> = {},
  token = "owner-token",
  origin = "http://localhost",
) {
  return new Request("http://localhost/api/auth/delete-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function handle(request = authRequest(), config = env) {
  const auth = createAuth(config, { waitUntil: () => {} }, request);
  // Better Auth disables origin checks in tests; exercise deployed protections.
  const context = await auth.$context;
  context.skipOriginCheck = false;
  context.skipCSRFCheck = false;
  return auth.handler(request);
}

function count(table: string, userId: string) {
  const column = table === "user" ? "id" : table === "party_boost" ? "ownerUserId" : "userId";
  return sqlite
    .prepare(`SELECT count(*) AS count FROM "${table}" WHERE "${column}" = ?`)
    .get(userId)?.count;
}

function expectAccount(userId: string, expected: number) {
  for (const table of ["user", "session", "account", "cloud_user_settings", "party_boost"]) {
    expect(count(table, userId), `${table} for ${userId}`).toBe(expected);
  }
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(fileURLToPath(migrations.href))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(fileURLToPath(new URL(file, migrations).href), "utf8"));
  }
  state.db = drizzle(
    async (query, params, method) => {
      const statement = sqlite.prepare(query);
      statement.setReturnArrays(true);
      if (method === "run") {
        statement.run(...params);
        return { rows: [] };
      }
      return {
        rows:
          method === "get"
            ? ((statement.get(...params) as unknown as unknown[] | undefined) ?? [])
            : statement.all(...params),
      };
    },
    { schema },
  );
  const now = Date.now();
  for (const id of ["owner", "other"]) {
    sqlite
      .prepare(
        "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
      )
      .run(id, id, `${id}@example.com`, now, now);
    sqlite
      .prepare(
        "INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(`${id}-session`, `${id}-token`, id, now + 86400000 * 7, now, now);
    sqlite
      .prepare(
        "INSERT INTO account (id, accountId, providerId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(`${id}-account`, id, "google", id, now, now);
    sqlite
      .prepare(
        "INSERT INTO cloud_user_settings (userId, partyListDocumentId, updatedAt) VALUES (?, ?, ?)",
      )
      .run(id, `${id}-list`, now);
    sqlite
      .prepare(
        "INSERT INTO party_boost (ownerUserId, partyDocumentId, assignedAt, transferableAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, `${id}-party`, now, now, now);
  }
  fetcher
    .mockReset()
    .mockResolvedValue(Response.json({ object: "customer", id: "owner", deleted_at: now }));
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.unstubAllGlobals();
  sqlite.close();
});

describe("authenticated account deletion", () => {
  it("uses the session identity even if the body targets another user", async () => {
    const response = await handle(authRequest({ userId: "other", customerId: "other" }));
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.revenuecat.com/v2/projects/test-project/customers/owner",
    );
    expectAccount("owner", 0);
    expectAccount("other", 1);
    // This path must not contact Automerge or perform subscription cancellation.
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(["", "invalid-token", "other-session"])(
    "rejects an invalid session (%s)",
    async (token) => {
      expect((await handle(authRequest({}, token))).status).toBe(401);
      expect(fetcher).not.toHaveBeenCalled();
      expectAccount("owner", 1);
      expectAccount("other", 1);
    },
  );

  it("requires a fresh session before any remote deletion", async () => {
    sqlite
      .prepare("UPDATE session SET createdAt = ? WHERE userId = ?")
      .run(Date.now() - 86400000 * 2, "owner");
    expect((await handle()).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expectAccount("owner", 1);
  });

  it("rejects an untrusted origin before any remote deletion", async () => {
    const request = authRequest({}, "owner-token", "https://attacker.example");
    request.headers.delete("Authorization");
    const signature = createHmac("sha256", env.BETTER_AUTH_SECRET!)
      .update("owner-token")
      .digest("base64");
    request.headers.set(
      "Cookie",
      `better-auth.session_token=${encodeURIComponent(`owner-token.${signature}`)}`,
    );
    expect((await handle(request)).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
    expectAccount("owner", 1);
  });

  it("keeps all cloud data on remote failure and allows retry with the same identity", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ type: "server_error" }, { status: 503 }));
    const failed = await handle();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({ code: "ACCOUNT_DELETION_UNAVAILABLE" });
    expectAccount("owner", 1);
    // Also covers a lost success response: RevenueCat may have deleted the customer already.
    fetcher.mockResolvedValueOnce(
      Response.json({ type: "resource_missing", param: "customer_id" }, { status: 404 }),
    );
    expect((await handle()).status).toBe(200);
    expectAccount("owner", 0);
    expectAccount("other", 1);
    expect((await handle()).status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("completes a retry after a lost response and an unscoped missing-customer error", async () => {
    fetcher.mockRejectedValueOnce(new Error("connection lost after remote deletion"));
    expect((await handle()).status).toBe(503);
    expectAccount("owner", 1);
    const missing = {
      object: "error",
      type: "resource_missing",
      message: "Resource not found",
      retryable: false,
    };
    fetcher
      .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
      .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ object: "list", items: [] }));
    expect((await handle()).status).toBe(200);
    expectAccount("owner", 0);
    expectAccount("other", 1);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each(["REVENUECAT_PROJECT_ID", "REVENUECAT_SECRET_API_KEY"] as const)(
    "keeps the account when %s is missing",
    async (key) => {
      expect((await handle(authRequest(), { ...env, [key]: undefined })).status).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
      expectAccount("owner", 1);
    },
  );
});
