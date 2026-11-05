import { OpenAPIHono } from "@hono/zod-openapi";
import { apiMigrateRoute } from "./routes/migrate";
import { createAuth } from "./auth";
import { cloudSyncRoute } from "./routes/cloud-sync";
import type { ApiEnv, ApiHonoEnv } from "./env";
import { cleanupMcpOperations } from "./mcp/cleanup";
import { getRedactedPath, workerLogger } from "./log";
import { createApiCorsMiddleware } from "./cors";
import { partySharePreviewRoute } from "./routes/party-share-preview";
import { createApiI18nMiddleware } from "./i18n";
import { premiumRoute } from "./routes/premium";
import { spycatRoute } from "./routes/spycat";
import { ANALYTICS_PROXY_PATH } from "../src/lib/api/analyticsConfig";
import { mcpRoute } from "./routes/mcp";

export const app = new OpenAPIHono<ApiHonoEnv>();

app.use("*", async (c, next) => {
  const startedAt = Date.now();
  const path = getRedactedPath(c.req.raw);

  try {
    await next();
  } catch (error) {
    workerLogger.error("Unhandled Worker request error", {
      error,
      method: c.req.method,
      path,
    });
    throw error;
  } finally {
    workerLogger.info("Worker request completed", {
      durationMs: Date.now() - startedAt,
      method: c.req.method,
      path,
      status: c.res.status,
    });
  }
});

app.use("*", createApiI18nMiddleware());

// MCP owns its Origin policy and protocol preflight headers.
app.route("/api/mcp", mcpRoute);

app.use("/api/*", createApiCorsMiddleware());

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/", partySharePreviewRoute);

app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.env, c.executionCtx, c.req.raw).handler(c.req.raw),
);

app.route("/api/cloud-sync", cloudSyncRoute);

app.route("/api/migrate", apiMigrateRoute);

app.route("/api/premium", premiumRoute);

app.route(ANALYTICS_PROXY_PATH, spycatRoute);

app.doc31("/api/openapi.json", {
  info: {
    description: "The HTTP contract used by trizum's first-party clients.",
    title: "trizum API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
});

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: ApiEnv) {
    const deleted = await cleanupMcpOperations(env.DB);
    workerLogger.info("Expired MCP receipts deleted", { deleted });
  },
} satisfies ExportedHandler<ApiEnv>;
