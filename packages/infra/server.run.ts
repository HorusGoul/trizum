import * as Alchemy from "alchemy";
import { retain } from "alchemy/RemovalPolicy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Fly from "@alchemy.run/fly";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { z } from "zod";
import { state } from "./src/cloudflare.js";
import { FlyServer, FlyServerProvider } from "./src/fly-server.js";
import { appName } from "./src/fly.js";

export default Alchemy.Stack(
  "trizum-server",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Fly.providers(), FlyServerProvider),
    state: state(),
  },
  Effect.gen(function* () {
    yield* Fly.App("App", { name: appName }).pipe(retain());
    // Pin existing physical identities. An absent disk/VM must fail, never recreate.
    const machineId = yield* Config.String("FLY_MACHINE_ID");
    const volumeId = yield* Config.String("FLY_VOLUME_ID");

    const image = z
      .string()
      .regex(/^registry\.fly\.io\/trizum-server@sha256:[a-f0-9]{64}$/)
      .parse(yield* Config.String("SERVER_IMAGE"));

    const commit = yield* Config.String("COMMIT_HASH");
    yield* FlyServer("Server", { machineId, volumeId, image, commit }).pipe(retain());

    return { url: "https://server.trizum.app", machineId, volumeId };
  }),
);
