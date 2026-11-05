import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { existingWorkerSecrets } from "./worker-secrets.js";
import { clientDirectory, config, workerBundle } from "./cloudflare.js";

export const pwa = (database: Cloudflare.D1.Database, preview = false) =>
  Effect.gen(function* () {
    const secrets = yield* existingWorkerSecrets;

    const worker = yield* Cloudflare.Worker("Pwa", {
      name: preview ? undefined : config.name,
      main: workerBundle,
      bundle: false,
      compatibility: { date: config.compatibility_date, flags: config.compatibility_flags },
      assets: {
        directory: clientDirectory,
        notFoundHandling: config.assets.not_found_handling,
        runWorkerFirst: config.assets.run_worker_first,
      },
      domain: preview ? undefined : config.routes[0].pattern,
      workersDev: preview ? undefined : true,
      version: preview
        ? { parent: "trizum", traffic: 0, alias: process.env.PREVIEW_ALIAS }
        : undefined,
      env: {
        ...config.vars,
        DB: database,
        [config.send_email[0].name]: Cloudflare.Email.SendEmail(config.send_email[0].name),
      },
      observability: preview
        ? undefined
        : {
            logs: {
              enabled: config.observability.logs.enabled,
              invocationLogs: config.observability.logs.invocation_logs,
              headSamplingRate: config.observability.logs.head_sampling_rate,
            },
            traces: {
              enabled: config.observability.traces.enabled,
              headSamplingRate: config.observability.traces.head_sampling_rate,
            },
          },
    });

    yield* worker.bind`ExistingSecrets`({ bindings: secrets });

    yield* worker.bind`InsightFlare`({
      bindings: [
        { type: "service", name: config.services[0].binding, service: config.services[0].service },
      ],
    });

    return worker;
  });
