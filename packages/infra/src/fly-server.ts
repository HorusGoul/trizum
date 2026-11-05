import { isResolved } from "alchemy/Diff";
import * as Schedule from "effect/Schedule";
import { Unowned } from "alchemy/AdoptPolicy";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as Effect from "effect/Effect";
import { z } from "zod";
import {
  desiredConfig,
  configMatches,
  flyRequest,
  machineSchema,
  validateStorage,
  volumeSchema,
  type Machine,
  type FlyRequestBody,
} from "./fly.js";

type Props = { machineId: string; volumeId: string; image: string; commit: string };

type Attributes = Props;

type FlyServer = Resource<"Trizum.FlyServer", Props, Attributes>;

export const FlyServer = Resource<FlyServer>("Trizum.FlyServer");

const request = <T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: FlyRequestBody,
  lease?: string,
) => Effect.tryPromise(() => flyRequest(path, schema, method, body, lease));

const observe = (props: Props) =>
  Effect.gen(function* () {
    const machine = yield* request(`machines/${props.machineId}`, machineSchema);
    const volume = yield* request(`volumes/${props.volumeId}`, volumeSchema);
    validateStorage(machine, volume, props.volumeId);

    return machine;
  });

const attrs = (props: Props, machine: Machine): Attributes => ({
  ...props,
  image: machine.config.image,
  commit: machine.config.env?.COMMIT_HASH ?? "",
});

// Native Fly.Machine currently drops fly.toml's volume auto-extension fields.
// This provider updates the pinned VM under a lease and preserves the exact disk.
export const FlyServerProvider = Provider.succeed(FlyServer, {
  read: Effect.fn(function* ({ olds, output }) {
    const props = olds ?? output;

    if (!props) return undefined;
    const machine = yield* observe(props);
    const result = attrs(props, machine);

    return output ? result : Unowned(result);
  }),
  diff: Effect.fn(function* ({ news, output }) {
    if (!output || !isResolved(news)) return { action: "update" };

    if (news.machineId !== output.machineId || news.volumeId !== output.volumeId) {
      return yield* Effect.die(
        "Changing the production Machine or volume ID requires a separate data migration.",
      );
    }

    const machine = yield* observe(news);

    if (!configMatches(machine, news.image, news.commit)) return { action: "update" };

    return undefined;
  }),
  reconcile: Effect.fn(function* ({ news }) {
    const machine = yield* observe(news);

    const leaseResponse = yield* request(
      `machines/${news.machineId}/lease`,
      z.object({ data: z.object({ nonce: z.string() }) }),
      "POST",
      {
        ttl: 300,
        description: "trizum Alchemy deployment",
      },
    );

    const lease = leaseResponse.data.nonce;

    yield* Effect.gen(function* () {
      // Re-read under the lease to reject a concurrent update since observation.
      const current = yield* observe(news);

      if (current.instance_id !== machine.instance_id) {
        return yield* Effect.die(
          "Fly Machine changed while acquiring its deployment lease; retry.",
        );
      }

      const updated = yield* request(
        `machines/${news.machineId}`,
        machineSchema,
        "POST",
        {
          current_version: current.instance_id,
          config: desiredConfig(current, news.image, news.commit),
        },
        lease,
      );

      yield* request(
        `machines/${news.machineId}/wait?state=started&timeout=60&instance_id=${encodeURIComponent(updated.instance_id)}`,
        z.json().optional(),
      );
    }).pipe(
      Effect.ensuring(
        request(
          `machines/${news.machineId}/lease`,
          z.json().optional(),
          "DELETE",
          undefined,
          lease,
        ).pipe(Effect.orDie),
      ),
    );
    const deployed = yield* observe(news);

    if (deployed.config.image !== news.image || deployed.config.env?.COMMIT_HASH !== news.commit) {
      return yield* Effect.die("Fly did not activate the requested server revision.");
    }

    yield* Effect.tryPromise(async () => {
      const response = await fetch("https://server.trizum.app/health", {
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) throw new Error(`Sync health check failed (${response.status}).`);
    }).pipe(Effect.retry({ times: 12, schedule: Schedule.spaced("5 seconds") }));

    return attrs(news, deployed);
  }),
  delete: () => Effect.die("The production sync server and disk must be retained."),
});
