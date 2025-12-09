import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";
import { getSentrySink } from "@logtape/sentry";
import packageJson from "#package.json" with { type: "json" };

configureSync({
  sinks: { console: getConsoleSink(), sentry: getSentrySink() },
  loggers: [
    { category: [], lowestLevel: "warning", sinks: ["sentry"] },
    { category: "@trizum/server", lowestLevel: "debug", sinks: ["console"] },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

export const rootLogger = getLogger("@trizum/server").with({
  version: `${packageJson.version}-${process.env.COMMIT_HASH}`,
});
