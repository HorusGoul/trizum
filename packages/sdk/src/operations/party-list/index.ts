/**
 * PartyList operations.
 */

import type { ITrizumClient } from "../../client.js";
import type { DocumentId } from "../../types.js";
import type { PartyList, UpdatePartyListInput } from "../../models/party-list.js";
import type { Party } from "../../models/party.js";

/**
 * Add a party to the user's party list.
 *
 * @param client - The Trizum client
 * @param partyListId - The party list document ID
 * @param partyId - The party to add
 * @param participantId - The user's participant ID in that party
 */
export async function addPartyToList(
  client: ITrizumClient,
  partyListId: DocumentId,
  partyId: DocumentId,
  participantId: string,
): Promise<void> {
  const handle = await client.findHandle<PartyList>(partyListId);
  const partyList = handle.doc();

  if (!partyList) {
    throw new Error("PartyList not found");
  }

  handle.change((doc) => {
    doc.parties[partyId] = true;

    if (!doc.participantInParties) {
      doc.participantInParties = {};
    }
    doc.participantInParties[partyId] = participantId;
  });
}

/**
 * Remove a party from the user's party list.
 *
 * @param client - The Trizum client
 * @param partyListId - The party list document ID
 * @param partyId - The party to remove
 */
export async function removePartyFromList(
  client: ITrizumClient,
  partyListId: DocumentId,
  partyId: DocumentId,
): Promise<void> {
  const handle = await client.findHandle<PartyList>(partyListId);
  const partyList = handle.doc();

  if (!partyList) {
    throw new Error("PartyList not found");
  }

  handle.change((doc) => {
    delete doc.parties[partyId];

    if (doc.participantInParties) {
      delete doc.participantInParties[partyId];
    }
  });
}

/**
 * Set the last opened party.
 *
 * @param client - The Trizum client
 * @param partyListId - The party list document ID
 * @param partyId - The party ID, or null to clear
 */
export async function setLastOpenedParty(
  client: ITrizumClient,
  partyListId: DocumentId,
  partyId: DocumentId | null,
): Promise<void> {
  const handle = await client.findHandle<PartyList>(partyListId);
  const partyList = handle.doc();

  if (!partyList) {
    throw new Error("PartyList not found");
  }

  handle.change((doc) => {
    doc.lastOpenedPartyId = partyId;
  });
}

/**
 * Update party list settings and optionally sync to all parties.
 *
 * @param client - The Trizum client
 * @param partyListId - The party list document ID
 * @param input - The settings to update
 * @param syncToParties - Whether to sync participant fields to all parties
 */
export async function updatePartyListSettings(
  client: ITrizumClient,
  partyListId: DocumentId,
  input: UpdatePartyListInput,
  syncToParties: boolean = true,
): Promise<void> {
  const handle = await client.findHandle<PartyList>(partyListId);
  const partyList = handle.doc();

  if (!partyList) {
    throw new Error("PartyList not found");
  }

  // Update local settings
  handle.change((doc) => {
    if (input.username !== undefined) {
      doc.username = input.username;
    }
    if (input.phone !== undefined) {
      doc.phone = input.phone;
    }
    if (input.avatarId !== undefined) {
      doc.avatarId = input.avatarId;
    }
    if (input.locale !== undefined) {
      doc.locale = input.locale;
    } else if (input.locale === undefined && "locale" in input) {
      delete doc.locale;
    }
    if (input.openLastPartyOnLaunch !== undefined) {
      doc.openLastPartyOnLaunch = input.openLastPartyOnLaunch;
    }
  });

  // Sync to all parties if requested
  if (syncToParties) {
    const updatedPartyList = handle.doc();
    if (!updatedPartyList) return;

    // Only sync participant-relevant fields
    const participantFields = {
      phone: input.phone,
      avatarId: input.avatarId,
    };

    // Skip if no participant fields to sync
    if (participantFields.phone === undefined && participantFields.avatarId === undefined) {
      return;
    }

    for (const partyId of Object.keys(updatedPartyList.participantInParties)) {
      const participantId = updatedPartyList.participantInParties[partyId as DocumentId];
      if (!participantId) continue;

      try {
        const partyHandle = await client.findHandle<Party>(partyId as DocumentId);
        const party = partyHandle.doc();
        if (!party) continue;

        partyHandle.change((doc) => {
          const participant = doc.participants[participantId];
          if (!participant) return;

          if (participantFields.phone !== undefined) {
            if (participantFields.phone === "") {
              delete participant.phone;
            } else {
              participant.phone = participantFields.phone;
            }
          }

          if (participantFields.avatarId !== undefined) {
            if (participantFields.avatarId === null) {
              delete participant.avatarId;
            } else {
              participant.avatarId = participantFields.avatarId;
            }
          }
        });
      } catch {
        // Skip parties that can't be found
        continue;
      }
    }
  }
}

/**
 * Get or create the root PartyList document.
 *
 * @param client - The Trizum client
 * @returns The PartyList document ID
 */
export function getOrCreatePartyList(client: ITrizumClient): DocumentId {
  return client.getOrCreateRootDocument<PartyList>("partyListId", () => ({
    type: "partyList",
    username: "",
    phone: "",
    parties: {},
    participantInParties: {},
  }));
}
