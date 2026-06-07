import * as Sentry from "@sentry/node";
import packageJson from "#package.json" with { type: "json" };
import { configureServerLogging, rootLogger } from "./log.ts";

configureServerLogging();

async function loadProfilingIntegration() {
  try {
    const { nodeProfilingIntegration } = await import("@sentry/profiling-node");
    return nodeProfilingIntegration();
  } catch (error) {
    rootLogger.warn("Sentry profiling integration unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });

    return undefined;
  }
}

if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
  const profilingIntegration = await loadProfilingIntegration();

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    integrations: profilingIntegration ? [profilingIntegration] : [],
    sampleRate: 1,
    // Tracing
    tracesSampleRate: 1,
    enableLogs: true,
    release: `${packageJson.version}-${process.env.COMMIT_HASH}`,
    ...(profilingIntegration
      ? {
          profileSessionSampleRate: 1,
          // Trace lifecycle automatically enables profiling during active traces
          profileLifecycle: "trace",
        }
      : {}),
  });
  rootLogger.info("Sentry initialized");
} else {
  rootLogger.info("Skipping Sentry initialization");
}
