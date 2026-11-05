import { z } from "zod";

export const appName = "trizum-server";
export const region = "cdg";

export const machineSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  state: z.string(),
  instance_id: z.string(),
  config: z.looseObject({
    image: z.string(),
    env: z.record(z.string(), z.string()).optional(),
    mounts: z.array(z.looseObject({ volume: z.string(), path: z.string() })),
  }),
});

export type Machine = z.infer<typeof machineSchema>;

export const volumeSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  size_gb: z.number(),
  attached_machine_id: z.string().nullish(),
});

export type Volume = z.infer<typeof volumeSchema>;

export function validateStorage(machine: Machine, volume: Volume, volumeId: string) {
  if (machine.region !== region || volume.region !== region) {
    throw new Error("The sync server and volume must remain in cdg.");
  }

  if (
    machine.config.mounts.length !== 1 ||
    machine.config.mounts[0].volume !== volumeId ||
    machine.config.mounts[0].path !== "/mnt/data" ||
    volume.id !== volumeId ||
    volume.name !== "trizum_data" ||
    volume.size_gb < 10 ||
    volume.attached_machine_id !== machine.id
  ) {
    throw new Error(
      "Fly storage does not match the existing trizum_data mount; refusing deployment.",
    );
  }
}

export function desiredConfig(machine: Machine, image: string, commit: string) {
  return {
    ...machine.config,
    image,
    env: {
      ...machine.config.env,
      DB_FILE_NAME: "file:/mnt/data/trizum.db",
      PORT: "3000",
      COMMIT_HASH: commit,
    },
    guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
    mounts: [
      {
        ...machine.config.mounts[0],
        extend_threshold_percent: 75,
        add_size_gb: 5,
        size_gb_limit: 200,
      },
    ],
    services: [
      {
        protocol: "tcp",
        internal_port: 3000,
        autostop: "off",
        autostart: true,
        min_machines_running: 1,
        ports: [
          { port: 80, handlers: ["http"], force_https: true },
          { port: 443, handlers: ["tls", "http"] },
        ],
        checks: [
          {
            type: "http",
            port: 3000,
            method: "GET",
            path: "/health",
            interval: "30s",
            timeout: "5s",
            grace_period: "10s",
            tls_skip_verify: false,
          },
        ],
      },
    ],
  };
}

const managedConfigSchema = z.object({
  image: z.string(),
  env: z.object({ DB_FILE_NAME: z.string(), PORT: z.string(), COMMIT_HASH: z.string() }),
  guest: z.object({ cpu_kind: z.string(), cpus: z.number(), memory_mb: z.number() }),
  mounts: z.array(
    z.object({
      volume: z.string(),
      path: z.string(),
      extend_threshold_percent: z.number(),
      add_size_gb: z.number(),
      size_gb_limit: z.number(),
    }),
  ),
  services: z.array(
    z.object({
      protocol: z.string(),
      internal_port: z.number(),
      autostop: z.string(),
      autostart: z.boolean(),
      min_machines_running: z.number(),
      ports: z.array(
        z.object({
          port: z.number(),
          handlers: z.array(z.string()),
          force_https: z.boolean().optional(),
        }),
      ),
      checks: z.array(
        z.object({
          type: z.string(),
          port: z.number(),
          method: z.string(),
          path: z.string(),
          interval: z.string(),
          timeout: z.string(),
          grace_period: z.string(),
          tls_skip_verify: z.boolean(),
        }),
      ),
    }),
  ),
});

export function configMatches(machine: Machine, image: string, commit: string) {
  const actual = managedConfigSchema.safeParse(machine.config);

  if (!actual.success) return false;
  const desired = managedConfigSchema.parse(desiredConfig(machine, image, commit));

  return JSON.stringify(actual.data) === JSON.stringify(desired);
}

export type FlyRequestBody =
  | { ttl: number; description: string }
  | { current_version: string; config: ReturnType<typeof desiredConfig> };

export async function flyRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: FlyRequestBody,
  lease?: string,
): Promise<T> {
  const token = process.env.FLY_API_TOKEN;

  if (!token) throw new Error("FLY_API_TOKEN is required for the existing server deployment.");

  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  if (lease) headers.set("fly-machine-lease-nonce", lease);

  const response = await fetch(`https://api.machines.dev/v1/apps/${appName}/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(70_000),
  });

  if (!response.ok) throw new Error(`Fly ${method} ${path} failed (${response.status}).`);
  const text = await response.text();

  return schema.parse(text ? JSON.parse(text) : undefined);
}
