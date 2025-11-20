import { configureSync, getConsoleSink, getLogger } from "@logtape/logtape";

configureSync({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: "@trizum/server", lowestLevel: "debug", sinks: ["console"] },
  ],
});

export const rootLogger = getLogger("@trizum/server");
