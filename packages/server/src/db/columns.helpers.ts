import { SQLiteTimestampBuilder } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const CURRENT_TIMESTAMP = sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`;

export const timestamps = {
  updatedAt: new SQLiteTimestampBuilder("updated_at", "timestamp_ms"),
  createdAt: new SQLiteTimestampBuilder("created_at", "timestamp_ms")
    .default(CURRENT_TIMESTAMP)
    .notNull(),
};
