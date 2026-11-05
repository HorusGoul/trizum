import * as Effect from "effect/Effect";
import { z } from "zod";
import { config } from "./cloudflare.js";

const settingsSchema = z.object({
  success: z.literal(true),
  result: z.object({ bindings: z.array(z.object({ type: z.string(), name: z.string() })) }),
});

type WorkerBindingMetadata = z.infer<typeof settingsSchema>["result"]["bindings"][number];

export function inheritSecrets(bindings: WorkerBindingMetadata[]) {
  const secrets = bindings.filter(
    (binding) => binding.type === "secret_text" || binding.type === "secret_key",
  );

  if (!secrets.some((binding) => binding.name === "BETTER_AUTH_SECRET")) {
    throw new Error(
      "The existing Worker must have BETTER_AUTH_SECRET before adopting or uploading a version.",
    );
  }

  return secrets.map((binding) => ({ type: "inherit" as const, name: binding.name }));
}

export const existingWorkerSecrets = Effect.tryPromise(async () => {
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!token)
    throw new Error("CLOUDFLARE_API_TOKEN is required to inherit existing Worker secrets.");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/${config.name}/settings`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) throw new Error(`Worker secret metadata lookup failed (${response.status}).`);

  return inheritSecrets(settingsSchema.parse(await response.json()).result.bindings);
}).pipe(Effect.orDie);
