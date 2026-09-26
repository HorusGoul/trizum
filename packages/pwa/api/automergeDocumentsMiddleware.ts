import type { MiddlewareHandler } from "hono";
import { AutomergeDocuments } from "./automergeDocuments";
import type { ApiEnv, ApiHonoEnv } from "./env";

export function createAutomergeDocumentsMiddleware(
  getTimeoutMs?: (env: ApiEnv) => string | undefined,
): MiddlewareHandler<ApiHonoEnv> {
  return async (c, next) => {
    // Nested middleware shares the outer request owner and its lifecycle.
    if (c.get("documents")) return next();

    const documents = new AutomergeDocuments({
      env: c.env,
      request: c.req.raw,
      timeoutMs: getTimeoutMs?.(c.env),
    });
    c.set("documents", documents);
    try {
      await next();
    } finally {
      await documents.close();
    }
  };
}
