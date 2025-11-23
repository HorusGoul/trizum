import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";
import { AsyncLocalStorage } from "node:async_hooks";

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: "@trizum/server", lowestLevel: "debug", sinks: ["console"] },
    {
      category: ["logtape", "meta"],
      lowestLevel: "warning",
      sinks: ["console"],
    },
  ],
  contextLocalStorage: new AsyncLocalStorage(),
});

export const rootLogger = getLogger("@trizum/server");
