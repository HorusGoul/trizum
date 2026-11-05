import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { state, verifyDatabaseIdentity } from "./src/cloudflare.js";
import { pwa } from "./src/pwa.js";

export default Alchemy.Stack(
  "trizum-pwa",
  { providers: Cloudflare.providers(), state: state() },
  Effect.gen(function* () {
    yield* verifyDatabaseIdentity;
    const database = yield* Cloudflare.D1.Database.ref("Database", { stage: "prod" });
    const worker = yield* pwa(database, true);

    return { url: worker.url };
  }),
);
