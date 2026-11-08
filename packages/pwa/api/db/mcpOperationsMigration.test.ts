import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";

const create = readFileSync(
  fileURLToPath(new URL("../../migrations/0007_mcp_operations.sql", import.meta.url).href),
  "utf8",
);

const drop = readFileSync(
  fileURLToPath(new URL("../../migrations/0008_drop_mcp_operations.sql", import.meta.url).href),
  "utf8",
);

test.each([false, true])(
  "drops obsolete MCP receipts while retaining other data (existing=%s)",
  (existing) => {
    const db = new DatabaseSync(":memory:");

    try {
      db.exec(
        "CREATE TABLE cloud_user_settings (userId TEXT PRIMARY KEY, partyListDocumentId TEXT)",
      );
      db.exec("INSERT INTO cloud_user_settings VALUES ('account', 'kept-profile')");

      if (existing) {
        db.exec(create);
        db.exec(
          "INSERT INTO mcp_operations (request_id, fingerprint, result) VALUES ('pending', 'hash', NULL), ('completed', 'hash', '{}')",
        );
      }

      db.exec(drop);
      expect(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE name IN ('mcp_operations', 'mcp_operations_created_at_idx')",
          )
          .all(),
      ).toEqual([]);
      expect(db.prepare("SELECT partyListDocumentId FROM cloud_user_settings").get()).toMatchObject(
        { partyListDocumentId: "kept-profile" },
      );
      expect(() => db.exec(drop)).not.toThrow();
    } finally {
      db.close();
    }
  },
);
