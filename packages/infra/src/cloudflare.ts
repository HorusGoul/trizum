import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";
import { z } from "zod";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

// Wrangler remains the shared binding configuration for Vite's local workerd.
const configSchema = z.object({
  name: z.string(),
  account_id: z.string(),
  compatibility_date: z.string(),
  compatibility_flags: z.array(z.string()),
  assets: z.object({
    not_found_handling: z.literal("single-page-application"),
    run_worker_first: z.array(z.string()),
  }),
  services: z.array(z.object({ binding: z.string(), service: z.string() })).length(1),
  send_email: z.array(z.object({ name: z.string() })).length(1),
  routes: z.array(z.object({ pattern: z.string(), custom_domain: z.literal(true) })).length(1),
  observability: z.object({
    logs: z.object({
      enabled: z.boolean(),
      invocation_logs: z.boolean(),
      head_sampling_rate: z.number(),
    }),
    traces: z.object({ enabled: z.boolean(), head_sampling_rate: z.number() }),
  }),
  vars: z.record(z.string(), z.string()),
  d1_databases: z.array(z.object({ database_name: z.string(), database_id: z.string() })).length(1),
});

export const config = configSchema.parse(
  parse(readFileSync(new URL("../../pwa/wrangler.jsonc", import.meta.url), "utf8")),
);

export const state = () => Cloudflare.state({ accountId: config.account_id });
export const clientDirectory = fileURLToPath(new URL("../../pwa/dist/client", import.meta.url));

export const workerBundle = fileURLToPath(
  new URL("../../pwa/dist/trizum/index.js", import.meta.url),
);

export const migrationsDirectory = fileURLToPath(new URL("../../pwa/migrations", import.meta.url));

export const verifyDatabaseIdentity = Effect.tryPromise(async () => {
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!token)
    throw new Error("CLOUDFLARE_API_TOKEN is required to verify the existing D1 database.");
  const expected = config.d1_databases[0];

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${expected.database_id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) throw new Error(`D1 identity verification failed (${response.status}).`);

  const database = z
    .object({
      success: z.literal(true),
      result: z.object({
        uuid: z.literal(expected.database_id),
        name: z.literal(expected.database_name),
      }),
    })
    .parse(await response.json());

  return database.result;
}).pipe(Effect.orDie);
