import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it } from "vite-plus/test";
import { isUniqueConstraintError } from "./errors";

describe("isUniqueConstraintError", () => {
  it("recognizes a direct uniqueness failure", () => {
    expect(isUniqueConstraintError(new Error("UNIQUE constraint failed"))).toBe(true);
  });

  it("recognizes D1 uniqueness failures wrapped by Drizzle", () => {
    const error = new DrizzleQueryError(
      "insert into party_boost values (?)",
      ["shareable-party-document-id"],
      new Error("D1_ERROR: UNIQUE constraint failed: party_boost.party_document_id"),
    );

    expect(isUniqueConstraintError(error)).toBe(true);
  });

  it("does not classify unrelated database failures as conflicts", () => {
    expect(isUniqueConstraintError(new Error("database unavailable"))).toBe(false);
  });
});
