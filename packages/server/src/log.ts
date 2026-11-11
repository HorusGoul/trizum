import type { LogRecord } from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";
import { getTrizumLogger, configureTrizumLogging } from "@trizum/logging";
import { AsyncLocalStorage } from "node:async_hooks";
import packageJson from "#package.json" with { type: "json" };

const contextLocalStorage = new AsyncLocalStorage<LogRecord["properties"]>();

const version = process.env.COMMIT_HASH
  ? `${packageJson.version}-${process.env.COMMIT_HASH}`
  : packageJson.version;

export function configureServerLogging(): void {
  configureTrizumLogging({
    surface: "server",
    consoleFormat: process.env.NODE_ENV === "production" ? "json" : "default",
    lowestLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
    extraSinks: {
      sentry: getSentrySink(),
    },
    extraLoggers: [{ category: [], lowestLevel: "error", sinks: ["sentry"] }],
    contextLocalStorage,
  });
}

export const rootLogger = getTrizumLogger("server").with({ version });
