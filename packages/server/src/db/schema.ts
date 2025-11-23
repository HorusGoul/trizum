import {
  blob,
  text,
  sqliteTable,
  SQLiteBooleanBuilder,
} from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns.helpers.ts";

export const automergeKV = sqliteTable("automerge_kv", {
  key: text("key").primaryKey(),
  value: blob("value", { mode: "buffer" }).notNull(),
  isDocument: new SQLiteBooleanBuilder("is_document", "boolean")
    .notNull()
    .default(false)
    .$type<boolean>(),
  ...timestamps,
});
