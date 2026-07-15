import { describe, expect, test } from "vite-plus/test";
import { toPartyParticipantRecord } from "./toPartyParticipantRecord.js";

describe("toPartyParticipantRecord", () => {
  test("removes form-only metadata from new participants", () => {
    const result = toPartyParticipantRecord([
      {
        id: "new-participant",
        name: "New participant",
        __isNew: true,
      },
    ]);

    expect(result).toEqual({
      "new-participant": {
        id: "new-participant",
        name: "New participant",
      },
    });
  });

  test("preserves existing participant details", () => {
    const result = toPartyParticipantRecord([
      {
        id: "existing-participant",
        name: "Existing participant",
        phone: "612345678",
        isArchived: true,
      },
    ]);

    expect(result).toEqual({
      "existing-participant": {
        id: "existing-participant",
        name: "Existing participant",
        phone: "612345678",
        isArchived: true,
      },
    });
  });
});
