import type { PartyParticipant } from "#src/models/party.js";
import type { PartyParticipantsFormValues } from "./types.js";

export function toggleParticipantArchived(
  values: PartyParticipantsFormValues["participants"],
  participant: PartyParticipant,
) {
  return values.map((current) => {
    if (current.id === participant.id) {
      return {
        ...current,
        isArchived: !participant.isArchived,
      };
    }

    return current;
  });
}
