import { configurePwaLogging, getLogger } from "../src/lib/log.js";

configurePwaLogging({
  lowestLevel: "info",
});

export const workerLogger = getLogger("api", "worker");
export const authLogger = getLogger("api", "auth");

export function createBetterAuthLogger() {
  return {
    level: "info" as const,
    log(level: "debug" | "error" | "info" | "warn", message: string, ...args: unknown[]) {
      const context = args.length > 0 ? { args } : undefined;

      switch (level) {
        case "debug":
          authLogger.debug(message, context);
          return;
        case "error":
          authLogger.error(message, context);
          return;
        case "warn":
          authLogger.warning(message, context);
          return;
        case "info":
          authLogger.info(message, context);
          return;
      }
    },
  };
}

export function getRedactedPath(request: Request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/auth/reset-password/")) {
    return "/api/auth/reset-password/:token";
  }

  return pathname;
}
