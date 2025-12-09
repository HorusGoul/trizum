import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import packageJson from "#package.json" with { type: "json" };
import { rootLogger } from "./log.ts";

if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    integrations: [nodeProfilingIntegration()],
    sampleRate: 1,
    // Tracing
    tracesSampleRate: 1,
    profileSessionSampleRate: 1,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: "trace",
    enableLogs: true,
    release: `${packageJson.version}-${process.env.COMMIT_HASH}`,
  });
  rootLogger.info("Sentry initialized");
} else {
  rootLogger.info("Skipping Sentry initialization");
}
