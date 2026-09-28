import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vite-plus/test";

test("boost IDs backfill active and revoked assignments without changing their lifecycle", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    // Only the user key is relevant to this migration's foreign key.
    db.exec('CREATE TABLE "user" (id TEXT PRIMARY KEY)');
    for (const name of ["0003_party_boost", "0004_party_boost_lifecycle"]) {
      db.exec(
        readFileSync(
          fileURLToPath(new URL(`../../migrations/${name}.sql`, import.meta.url).href),
          "utf8",
        ),
      );
    }
    db.exec("INSERT INTO user VALUES ('active-owner'), ('revoked-owner')");
    db.exec(`INSERT INTO party_boost
      (ownerUserId, partyDocumentId, assignedAt, transferableAt, updatedAt, revokedAt, revocationReason, version)
      VALUES ('active-owner', 'party', 100, 200, 150, NULL, NULL, 3),
             ('revoked-owner', 'party', 50, 170, 140, 140, 'premium_inactive', 7)`);
    const original = db.prepare("SELECT * FROM party_boost ORDER BY ownerUserId").all();
    db.exec(
      readFileSync(
        fileURLToPath(new URL("../../migrations/0005_party_boost_id.sql", import.meta.url).href),
        "utf8",
      ),
    );
    const migrated = db.prepare("SELECT * FROM party_boost ORDER BY ownerUserId").all();
    expect(
      migrated.map(({ boostId, ...row }) => {
        expect(boostId).toMatch(/^[a-f0-9]{32}$/);
        return row;
      }),
    ).toEqual(original);
    expect(new Set(migrated.map((row) => row.boostId)).size).toBe(2);
    expect(() =>
      db.exec("UPDATE party_boost SET revokedAt = NULL WHERE ownerUserId = 'revoked-owner'"),
    ).toThrow(/UNIQUE/);
    expect(() =>
      db.exec(
        "UPDATE party_boost SET ownerUserId = 'active-owner' WHERE ownerUserId = 'revoked-owner'",
      ),
    ).toThrow(/UNIQUE/);
    db.exec("DELETE FROM user WHERE id = 'active-owner'");
    expect(db.prepare("SELECT COUNT(*) AS count FROM party_boost").get()?.count).toBe(1);
    // The previous Worker can still create assignments between migration and deployment.
    db.exec("INSERT INTO user VALUES ('old-worker-owner')");
    db.exec(`INSERT INTO party_boost
      (ownerUserId, partyDocumentId, assignedAt, transferableAt, updatedAt)
      VALUES ('old-worker-owner', 'another-party', 300, 400, 300)`);
    expect(
      db.prepare("SELECT boostId FROM party_boost WHERE ownerUserId = 'old-worker-owner'").get()
        ?.boostId,
    ).toMatch(/^[a-f0-9]{32}$/);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  } finally {
    db.close();
  }
});
