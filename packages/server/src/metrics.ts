import type { NodeClient } from "@sentry/node";
import { z } from "zod";

// Metrics inherit request scope attributes after beforeSendMetric. Filter at the
// envelope boundary so URLs, identities, and document tokens cannot become dimensions.
const metricContainer = z.object({
  items: z.array(z.object({ attributes: z.record(z.string(), z.unknown()).optional() })),
});

const dimensionValues = new Map([
  [
    "operation",
    new Set([
      "load",
      "save",
      "remove",
      "loadRange",
      "removeRange",
      "doc-compacted",
      "doc-saved",
      "doc-loaded",
      "receive-sync-message",
      "generate-sync-message",
    ]),
  ],
  ["chunkType", new Set(["snapshot", "incremental", "sync-state", "metadata"])],
  ["outcome", new Set(["success", "error"])],
  ["closeCategory", new Set(["normal", "going_away", "abnormal"])],
]);

const stringAttribute = z.object({ value: z.string() });

const allowedAttributes = new Set([
  "operation",
  "chunkType",
  "outcome",
  "closeCategory",
  "sentry.environment",
  "sentry.release",
  "sentry.sdk.name",
  "sentry.sdk.version",
]);

export const serverMetricsIntegration = {
  name: "TrizumServerMetrics",
  setup(client: NodeClient) {
    client.on("beforeEnvelope", (envelope) => {
      for (const item of envelope[1]) {
        if (item[0].type !== "trace_metric") continue;
        const parsed = metricContainer.safeParse(item[1]);

        if (!parsed.success) continue;
        const payload = item[1];
        // SAFETY: The schema above validates the SDK-owned metric container;
        // only attributes change, retaining timestamps, values, and trace links.
        const container = payload as z.infer<typeof metricContainer>;

        for (const metric of container.items) {
          metric.attributes = Object.fromEntries(
            Object.entries(metric.attributes ?? {}).filter(([key, attribute]) => {
              if (!allowedAttributes.has(key)) return false;
              const values = dimensionValues.get(key);

              if (!values) return true;
              const parsedAttribute = stringAttribute.safeParse(attribute);

              return parsedAttribute.success && values.has(parsedAttribute.data.value);
            }),
          );
        }
      }
    });
  },
};
