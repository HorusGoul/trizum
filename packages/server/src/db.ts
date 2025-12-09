import { drizzle } from "drizzle-orm/libsql";
import { env } from "#src/env.ts";
import * as schema from "#src/db/schema.ts";
import { instrumentDrizzleClient } from "@kubiks/otel-drizzle";

export const db = drizzle(env.DB_FILE_NAME, {
  schema,
});

instrumentDrizzleClient(db, { dbSystem: "sqlite" });

export type Database = typeof db;
