import { Hono } from "hono";
import { apiMigrateRoute } from "./routes/migrate";
import { cors } from "hono/cors";
import { createAuth, isTrustedOrigin } from "./auth";
import { cloudSyncRoute } from "./routes/cloud-sync";
import type { ApiHonoEnv } from "./env";
import { getRedactedPath, workerLogger } from "./log";

const app = new Hono<ApiHonoEnv>();

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

app.use(
  "/api/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 600,
    origin: (origin, c) => {
      if (!origin) {
        return undefined;
      }

      return isTrustedOrigin(origin, c.env) ? origin : undefined;
    },
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));
app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.env, c.executionCtx, c.req.raw).handler(c.req.raw),
);
app.route("/api/cloud-sync", cloudSyncRoute);
app.route("/api/migrate", apiMigrateRoute);

export default app;
