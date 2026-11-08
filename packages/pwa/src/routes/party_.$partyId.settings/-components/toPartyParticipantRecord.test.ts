import { describe, expect, test } from "vite-plus/test";
import { Repo } from "@automerge/automerge-repo";
import { FormApi } from "@tanstack/react-form";
import type { Party, PartyParticipant } from "#src/models/party.ts";
import type { PaymentMethods } from "#src/models/paymentMethod.ts";
import type { PartyParticipantsFormValues } from "./types.ts";
import { toPartyParticipantRecord } from "./toPartyParticipantRecord.js";

describe("toPartyParticipantRecord", () => {
  test.each<{ label: string; paymentMethods?: PaymentMethods }>([
    { label: "legacy participant without payment methods" },
    { label: "explicitly empty payment methods", paymentMethods: {} },
    {
      label: "configured payment methods",
      paymentMethods: { paypal: "https://paypal.me/Alice123", other: "Wise: alice@example.com" },
    },
  ])("saves participant form edits with $label back to Automerge", async ({ paymentMethods }) => {
    const repo = new Repo({ network: [] });
    const alice: PartyParticipant = { id: "alice", name: "Alice", phone: "+34612345678" };

    if (paymentMethods !== undefined) alice.paymentMethods = paymentMethods;

    const handle = repo.create<{ participants: Party["participants"] }>({
      participants: {
        alice,
        bob: { id: "bob", name: "Bob" },
      },
    });

    const defaultValues: PartyParticipantsFormValues = {
      participants: Object.values(handle.doc().participants),
    };

    const form = new FormApi({ defaultValues });
    const unmount = form.mount();

    try {
      form.setFieldValue("participants[0].name", "Renamed Alice");
      form.setFieldValue("participants[1].isArchived", true);
      form.pushFieldValue("participants", { id: "charlie", name: "Charlie", __isNew: true });
      const participants = toPartyParticipantRecord(form.state.values.participants);
      handle.change((doc) => {
        doc.participants = participants;
      });

      const saved = handle.doc().participants;
      expect(saved.alice).toEqual({ ...alice, name: "Renamed Alice" });
      expect(Object.hasOwn(saved.alice!, "paymentMethods")).toBe(paymentMethods !== undefined);
      expect(saved.bob).toEqual({ id: "bob", name: "Bob", isArchived: true });
      expect(saved.charlie).toEqual({ id: "charlie", name: "Charlie" });
    } finally {
      unmount();
      await repo.shutdown();
    }
  });

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
