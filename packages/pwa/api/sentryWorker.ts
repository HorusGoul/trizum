import { getSentrySink } from "@logtape/sentry";
import { sentryLoggerConfig } from "@trizum/logging/sentry";
import { workerLogger } from "./log";
import { configurePwaLogging } from "../src/lib/log";
import app from "./worker";

configurePwaLogging({
  consoleFormat: "json",
  lowestLevel: "info",
  extraSinks: { sentry: getSentrySink() },
  extraLoggers: [sentryLoggerConfig],
});

// Preview-only probe: exercise structured logs and Hono's unhandled-error capture.
app.post("/api/observability-check", (c) => {
  if (c.env.SENTRY_ENVIRONMENT !== "preview") return c.notFound();

  workerLogger.warning("Worker observability preview check");
  throw new Error("Worker observability preview check");
});

export default app;
