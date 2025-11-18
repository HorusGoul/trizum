import {
  blob,
  text,
  sqliteTable,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { timestamps } from "./columns.helpers.ts";

export const automergeDocument = sqliteTable(
  "automerge_document",
  {
    documentId: text("document_id").notNull(),
    chunkType: text("chunk_type")
      .$type<"snapshot" | "incremental" | "sync-state">()
      .notNull(),
    chunkId: text("chunk_id").notNull(),
    data: blob("data").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({
      name: "pk_automerge_document_key",
      columns: [table.documentId, table.chunkType, table.chunkId],
    }),

    index("idx_automerge_document_document_id").on(table.documentId),
  ],
);
