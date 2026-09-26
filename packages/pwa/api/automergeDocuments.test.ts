import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo";
import { Hono } from "hono";
import type { ApiEnv, ApiHonoEnv } from "./env";
import { createAutomergeDocumentsMiddleware } from "./automergeDocumentsMiddleware";
import { expect, it } from "vite-plus/test";
import { getAutomergeWssUrl, AutomergeDocuments } from "./automergeDocuments";

it.each([
  ["http://localhost:3000", "wss://dev-sync.trizum.app"],
  ["http://127.0.0.1:3000", "wss://dev-sync.trizum.app"],
  ["https://trizum.app", "wss://server.trizum.app/sync"],
])("selects the default sync server for %s", (url, expected) => {
  expect(getAutomergeWssUrl({}, new Request(url))).toBe(expected);
});

it("uses the configured sync server even for a local request", () => {
  expect(
    getAutomergeWssUrl(
      { AUTOMERGE_WSS_URL: " wss://sync.example.test/path " },
      new Request("http://localhost:3000"),
    ),
  ).toBe("wss://sync.example.test/path");
});

it("rejects an already cancelled request before opening a connection", async () => {
  const documents = new AutomergeDocuments({
    env: { AUTOMERGE_WSS_URL: "not a URL" },
    request: new Request("https://trizum.app", { signal: AbortSignal.abort() }),
  });
  try {
    await expect(
      documents.read(parseAutomergeUrl(generateAutomergeUrl()).documentId),
    ).rejects.toMatchObject({ name: "AbortError" });
  } finally {
    await documents.close();
  }
});

it("does not initialize an unused repo and prevents reads after close", async () => {
  const documents = new AutomergeDocuments({
    env: { AUTOMERGE_WSS_URL: "not a URL" },
    request: new Request("https://trizum.app"),
  });
  await documents.close();
  await documents.close();
  await expect(
    documents.read(parseAutomergeUrl(generateAutomergeUrl()).documentId),
  ).rejects.toMatchObject({ name: "AbortError" });
});

it("adds the object to request context without connecting when the handler does not read", async () => {
  const app = new Hono<ApiHonoEnv>();
  app.use("*", createAutomergeDocumentsMiddleware());
  app.get("/", (c) => {
    expect(c.get("documents")).toBeInstanceOf(AutomergeDocuments);
    return c.text("No documents needed");
  });
  const response = await app.request("https://trizum.app", {}, {
    AUTOMERGE_WSS_URL: "not a URL",
  } as ApiEnv);
  expect(await response.text()).toBe("No documents needed");
});
