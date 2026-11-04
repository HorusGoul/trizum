import { z } from "zod";
import { safeJoin, type Breadcrumb, type Integration } from "@sentry/core";

import { redactValue } from "./redaction.js";

function redactSentryPayload<T extends object>(payload: T): T {
  // Keep payload schemas and correlation fields while sanitizing strings.
  // SAFETY: Sentry owns this payload schema; redaction preserves its object structure and sanitizes string fields at the transport boundary.
  return redactValue(payload) as T;
}

function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const sanitized = redactSentryPayload(breadcrumb);
  const args: unknown = sanitized.data?.arguments;

  if (sanitized.category !== "console" || !Array.isArray(args)) {
    return sanitized;
  }

  const format = consoleFormatSchema.safeParse(args[0]);

  if (!format.success) return sanitized;

  // Browser-specific directives (such as %.2f) can consume arguments too.
  // Preserve unfamiliar formats rather than mistake a diagnostic value for CSS.
  if (/%(?![csdifoO])/.test(format.data.replace(/%%/g, ""))) return sanitized;

  const remaining: unknown[] = [];
  let argumentIndex = 1;
  let removedStyle = false;

  const message = format.data.replace(/%[%csdifoO]/g, (token: string) => {
    if (token === "%%" || argumentIndex >= args.length) return token;
    const argument = args[argumentIndex++];

    if (token === "%c") {
      removedStyle = true;

      return "";
    }

    remaining.push(argument);

    return token;
  });

  if (!removedStyle) return sanitized;

  const cleanedArgs = [message, ...remaining, ...args.slice(argumentIndex)];

  return {
    ...sanitized,
    message: safeJoin(cleanedArgs, " "),
    data: { ...sanitized.data, arguments: cleanedArgs },
  };
}

const logRedactionIntegration: Integration = {
  name: "TrizumDocumentIdRedaction",
  setup(client) {
    client.on("beforeEnvelope", (envelope) => {
      for (const item of envelope[1]) {
        if (item[0].type === "log") {
          // Scope attributes are merged after beforeSendLog. At this boundary,
          // formatted messages are strings and all log attributes are present.
          // SAFETY: The SDK log item owns this payload; redaction preserves its structure while sanitizing string attributes.
          item[1] = redactValue(item[1]) as (typeof item)[1];
        }
      }
    });
  },
};

/** Spread into Sentry.init(), retaining these integrations when adding others. */
export const sentryDocumentIdRedaction = {
  beforeBreadcrumb: sanitizeBreadcrumb,
  beforeSend: redactSentryPayload,
  beforeSendSpan: redactSentryPayload,
  beforeSendTransaction: redactSentryPayload,
  integrations: [logRedactionIntegration],
};

const consoleFormatSchema = z.string();
