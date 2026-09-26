import type { Integration } from "@sentry/core";

import { redactValue } from "./redaction.js";

function redactSentryPayload<T extends object>(payload: T): T {
  // Keep payload schemas and correlation fields while sanitizing strings.
  return redactValue(payload) as T;
}

const logRedactionIntegration: Integration = {
  name: "TrizumDocumentIdRedaction",
  setup(client) {
    client.on("beforeEnvelope", (envelope) => {
      for (const item of envelope[1]) {
        if (item[0].type === "log") {
          // Scope attributes are merged after beforeSendLog. At this boundary,
          // formatted messages are strings and all log attributes are present.
          item[1] = redactValue(item[1]) as (typeof item)[1];
        }
      }
    });
  },
};

/** Spread into Sentry.init(), retaining these integrations when adding others. */
export const sentryDocumentIdRedaction = {
  beforeBreadcrumb: redactSentryPayload,
  beforeSend: redactSentryPayload,
  beforeSendSpan: redactSentryPayload,
  beforeSendTransaction: redactSentryPayload,
  integrations: [logRedactionIntegration],
};
