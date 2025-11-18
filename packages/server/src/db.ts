import { drizzle } from "drizzle-orm/libsql";
import { env } from "#src/env.ts";
import * as schema from "#src/db/schema.ts";

export const db = drizzle(env.DB_FILE_NAME, {
  schema,
});

export type Database = typeof db;
