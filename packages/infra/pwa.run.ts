import * as Alchemy from "alchemy";
import { retain } from "alchemy/RemovalPolicy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import { config, migrationsDirectory, state, verifyDatabaseIdentity } from "./src/cloudflare.js";
import { pwa } from "./src/pwa.js";

export default Alchemy.Stack(
  "trizum-pwa",
  { providers: Cloudflare.providers(), state: state() },
  Effect.gen(function* () {
    yield* verifyDatabaseIdentity;

    const database = yield* Cloudflare.D1.Database("Database", {
      name: config.d1_databases[0].database_name,
      migrations: migrationsDirectory,
    }).pipe(retain());

    const worker = yield* pwa(database).pipe(retain());

    return { url: worker.url, databaseId: database.databaseId };
  }),
);
