import { useSuspenseDocument } from "#src/lib/automerge/suspense-hooks.js";
import type { Party } from "#src/models/party.js";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";

export function useParty(partyId: string) {
  if (!isValidDocumentId(partyId)) throw new Error("Malformed Party ID");
  const [party, handle] = useSuspenseDocument<Party>(partyId, {
    required: true,
  });

  function updateSettings(
    values: Pick<Party, "name" | "description" | "participants">,
  ) {
    handle.change((doc) => {
      doc.name = values.name;
      doc.description = values.description;
      doc.participants = values.participants;
    });
  }

  return {
    party,
    partyId,
    isLoading: handle.inState(["loading"]),
    updateSettings,
  };
}
