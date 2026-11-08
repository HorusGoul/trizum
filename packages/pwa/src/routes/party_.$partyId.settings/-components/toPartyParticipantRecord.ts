import type { Party, PartyParticipant } from "#src/models/party.js";
import type { PartyParticipantsFormValues } from "./types.js";

export function toPartyParticipantRecord(
  participants: PartyParticipantsFormValues["participants"],
) {
  const result: Party["participants"] = {};

  for (const participant of participants) {
    const savedParticipant: PartyParticipant =
      "__isNew" in participant
        ? {
            id: participant.id,
            name: participant.name,
          }
        : { ...participant };

    // Nested Automerge objects must be detached before writing the record back.
    if (savedParticipant.paymentMethods !== undefined) {
      savedParticipant.paymentMethods = { ...savedParticipant.paymentMethods };
    }

    result[savedParticipant.id] = savedParticipant;
  }

  return result;
}
