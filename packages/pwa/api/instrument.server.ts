/// <reference types="vite/client" />

import { defineCloudflareOptions } from "@sentry/cloudflare";
import { sentryDocumentIdRedaction } from "@trizum/logging/sentry";
import type { ApiEnv } from "./env";

export default defineCloudflareOptions<ApiEnv>((env) => ({
  ...sentryDocumentIdRedaction,
  dsn: env.SENTRY_DSN,
  enabled: import.meta.env.PROD && env.SENTRY_ENABLED !== "false",
  environment: env.SENTRY_ENVIRONMENT ?? "production",
  release: env.CF_VERSION_METADATA?.id,
  initialScope: { tags: { runtime: "cloudflare-worker" } },
  enableLogs: true,
  tracesSampleRate: 1,
  sendDefaultPii: false,
  dataCollection: {
    userInfo: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    cookies: false,
  },
  tracePropagationTargets: [/^https:\/\/server\.trizum\.app(?:\/|$)/],
}));
