import { cors } from "hono/cors";
import { isTrustedOrigin } from "./auth-origins";

export function createApiCorsMiddleware() {
  return cors({
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 600,
    origin: (origin, c) => {
      if (!origin) {
        return undefined;
      }

      return isTrustedOrigin(origin, c.env) ? origin : undefined;
    },
  });
}
