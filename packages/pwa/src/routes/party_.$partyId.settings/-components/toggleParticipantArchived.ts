import type { PartyParticipant } from "#src/models/party.js";
import type { PartySettingsFormValues } from "./types.js";

export function toggleParticipantArchived(
  values: PartySettingsFormValues["participants"],
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
