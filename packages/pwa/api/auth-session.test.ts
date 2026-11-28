import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createAuth, getSessionWithoutRefresh } from "./auth";
import type { ApiEnv } from "./env";
import * as schema from "./db/schema";

const DAY_MS = 86_400_000;
const SECRET = "test-session-renewal-secret-at-least-32-characters";

let sqlite: DatabaseSync;
let database: ReturnType<typeof drizzle>;

function sessionCookie(token: string) {
  const signature = createHmac("sha256", SECRET).update(token).digest("base64");

  return `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
}

function createTestAuth(request: Request) {
  // SAFETY: Session reads only need the secret; services provide the in-memory database.
  return createAuth({ BETTER_AUTH_SECRET: SECRET } as ApiEnv, { waitUntil: () => {} }, request, {
    database,
  });
}

function sessionExpiresAt() {
  const row = sqlite.prepare("SELECT expiresAt FROM session WHERE id = 'owner-session'").get();

  return row?.expiresAt;
}

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../migrations/", import.meta.url);

  for (const file of readdirSync(fileURLToPath(migrations.href))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(fileURLToPath(new URL(file, migrations).href), "utf8"));
  }

  database = drizzle(
    async (query, params, method) => {
      const statement = sqlite.prepare(query);
      statement.setReturnArrays(true);

      if (method === "run") {
        statement.run(...params);

        return { rows: [] };
      }

      if (method === "get") {
        const row = statement.get(...params);

        return { rows: row ? Object.values(row) : [] };
      }

      return { rows: statement.all(...params) };
    },
    { schema },
  );

  const now = Date.now();
  sqlite
    .prepare(
      "INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)",
    )
    .run("owner", "owner", "owner@example.com", now, now);
  // A session issued under the previous 7-day lifetime, due for renewal.
  sqlite
    .prepare(
      "INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run("owner-session", "owner-token", "owner", now + DAY_MS * 6, now - DAY_MS, now - DAY_MS);
});

afterEach(() => {
  sqlite.close();
});

describe("session renewal", () => {
  it("leaves renewal to the browser session endpoint so the refreshed cookie is delivered", async () => {
    const apiRequest = new Request("http://localhost/api/cloud-sync/settings", {
      headers: { Cookie: sessionCookie("owner-token") },
    });

    const expiresBefore = sessionExpiresAt();

    const session = await getSessionWithoutRefresh(createTestAuth(apiRequest), apiRequest.headers);

    expect(session?.user.id).toBe("owner");
    expect(sessionExpiresAt()).toBe(expiresBefore);

    const sessionRequest = new Request("http://localhost/api/auth/get-session", {
      headers: { Cookie: sessionCookie("owner-token") },
    });

    const response = await createTestAuth(sessionRequest).handler(sessionRequest);

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(
      /better-auth\.session_token=[^;]+;\s*Max-Age=2592000/,
    );
    expect(sessionExpiresAt()).toBeGreaterThan(Date.now() + DAY_MS * 29);
  });
});
