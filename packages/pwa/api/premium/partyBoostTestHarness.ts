import {
  generateAutomergeUrl,
  parseAutomergeUrl,
  type DocumentId,
} from "@automerge/automerge-repo/slim";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { vi } from "vite-plus/test";
import { AutomergeDocuments } from "../automergeDocuments";
import { createAuth } from "../auth";
import type { ApiEnv } from "../env";
import { premiumRoute } from "../routes/premium";

export type TestCustomerAccess =
  | "subscription"
  | "lifetime"
  | "inactive"
  | "sandbox"
  | "family_shared"
  | "test_store";

/** Real routes, auth, migrations and local D1; only sync documents and RevenueCat HTTP are fixtures. */
export async function createPartyBoostTestHarness() {
  const directory = await mkdtemp(join(tmpdir(), "trizum-party-boost-test-"));
  const configPath = join(directory, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "party-boost-test",
      compatibility_date: "2025-11-18",
      d1_databases: [{ binding: "DB", database_name: "test", database_id: "test" }],
    }),
  );
  const platform = await getPlatformProxy<ApiEnv>({
    configPath,
    envFiles: [],
    persist: false,
    remoteBindings: false,
  });
  const env: ApiEnv = {
    ...platform.env,
    BETTER_AUTH_SECRET: "isolated-party-boost-test-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:8787",
    REVENUECAT_PROJECT_ID: "test-project",
    REVENUECAT_SECRET_API_KEY: "test-only-key",
  };
  const migrations = fileURLToPath(new URL("../../migrations/", import.meta.url).href);
  for (const filename of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(join(migrations, filename), "utf8");
    for (const statement of sql
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)) {
      await env.DB.prepare(statement).run();
    }
  }

  const documents = new Map<DocumentId, Record<string, unknown>>();
  const customers = new Map<string, TestCustomerAccess>();
  const requests: Request[] = [];
  let revenueCatStatus = 200;
  let syncUnavailable = false;
  let writesUnavailable = false;
  const read = vi.spyOn(AutomergeDocuments.prototype, "read").mockImplementation(async (id) => {
    if (syncUnavailable) throw new Error("Test sync outage");
    const document = documents.get(id);
    if (!document) throw new Error("Missing test document");
    return structuredClone(document);
  });
  const change = vi
    .spyOn(AutomergeDocuments.prototype, "change")
    .mockImplementation(async (id, update) => {
      if (writesUnavailable || syncUnavailable) throw new Error("Test sync write outage");
      const document = documents.get(id);
      if (!document) throw new Error("Missing test document");
      update(document);
      return structuredClone(document);
    });
  const nativeFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1")
      return nativeFetch(input, init);
    if (url.origin !== "https://api.revenuecat.com")
      throw new Error("Unexpected external test request");
    requests.push(request);
    if (revenueCatStatus !== 200)
      return Response.json({ object: "error" }, { status: revenueCatStatus });
    const userId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
    const access = customers.get(userId) ?? "inactive";
    const purchase = url.pathname.endsWith("/purchases");
    const included =
      access !== "inactive" && (purchase ? access === "lifetime" : access !== "lifetime");
    return Response.json({
      object: "list",
      next_page: null,
      url: url.pathname,
      items: included
        ? [
            {
              id: `resource-${userId}`,
              environment: access === "sandbox" ? "sandbox" : "production",
              ownership: access === "family_shared" ? "family_shared" : "purchased",
              store: access === "test_store" ? "test_store" : "app_store",
              ...(purchase ? { status: "owned" } : { gives_access: true, status: "active" }),
              entitlements: { items: [{ lookup_key: "premium", state: "active" }] },
            },
          ]
        : [],
    });
  });

  return {
    env,
    customers,
    documents,
    requests,
    setRevenueCatStatus(status: number) {
      revenueCatStatus = status;
    },
    setSyncUnavailable(value: boolean) {
      syncUnavailable = value;
    },
    setWritesUnavailable(value: boolean) {
      writesUnavailable = value;
    },
    createParty() {
      const id = createDocumentId();
      documents.set(id, { type: "party", id, participants: {} });
      return id;
    },
    async createUser() {
      const request = new Request("http://localhost:8787/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:8787" },
        body: JSON.stringify({
          name: "Test member",
          email: `${crypto.randomUUID()}@example.test`,
          password: "test-password-only",
        }),
      });
      const response = await createAuth(env, platform.ctx, request).handler(request);
      if (!response.ok)
        throw new Error(`Test signup failed: ${response.status} ${await response.text()}`);
      const { user } = (await response.json()) as { user: { id: string } };
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const listId = createDocumentId();
      const list = {
        type: "partyList",
        parties: {} as Record<string, true>,
        participantInParties: {} as Record<string, string>,
      };
      documents.set(listId, list);
      await env.DB.prepare(
        "INSERT INTO cloud_user_settings (userId, partyListDocumentId, updatedAt) VALUES (?, ?, ?)",
      )
        .bind(user.id, listId, Date.now())
        .run();
      const participantId = crypto.randomUUID();
      return {
        participantId,
        id: user.id,
        cookie,
        join(partyId: DocumentId) {
          const party = documents.get(partyId)!;
          const participants = party.participants as Record<string, unknown>;
          participants[participantId] = { id: participantId, isArchived: false };
          list.parties[partyId] = true;
          list.participantInParties[partyId] = participantId;
        },
        leave(partyId: DocumentId) {
          const party = documents.get(partyId)!;
          const participants = party.participants as Record<string, unknown>;
          participants[participantId] = { id: participantId, isArchived: true };
        },
      };
    },
    async request(method: "GET" | "PUT", partyId: string, cookie?: string) {
      const url = new URL("http://localhost:8787/party-boost");
      if (method === "GET") url.searchParams.set("partyDocumentId", partyId);
      return premiumRoute.fetch(
        new Request(url, {
          method,
          headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
          ...(method === "PUT" ? { body: JSON.stringify({ partyDocumentId: partyId }) } : {}),
        }),
        env,
        platform.ctx,
      );
    },
    async assignment(userId: string) {
      return env.DB.prepare("SELECT * FROM party_boost WHERE ownerUserId = ?").bind(userId).first<{
        boostId: string;
        partyDocumentId: string;
        assignedAt: number;
        transferableAt: number;
        revokedAt: number | null;
        revocationReason: string | null;
        version: number;
      }>();
    },
    async dispose() {
      read.mockRestore();
      change.mockRestore();
      vi.unstubAllGlobals();
      await platform.dispose();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function createDocumentId() {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}
