/**
 * Update party operations.
 */

import type { ITrizumClient } from "../../client.js";
import type { DocumentId } from "../../types.js";
import type { Party, PartyParticipant } from "../../models/party.js";

/**
 * Input for updating party settings.
 */
export interface UpdatePartyInput {
  name?: string;
  description?: string;
  hue?: number;
  participants?: Party["participants"];
}

/**
 * Update party settings.
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 * @param input - The fields to update
 */
export async function updateParty(
  client: ITrizumClient,
  partyId: DocumentId,
  input: UpdatePartyInput,
): Promise<void> {
  const handle = await client.findHandle<Party>(partyId);
  const party = handle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  handle.change((doc) => {
    if (input.name !== undefined) {
      doc.name = input.name;
    }
    if (input.description !== undefined) {
      doc.description = input.description;
    }
    if (input.hue !== undefined) {
      doc.hue = input.hue;
    }
    if (input.participants !== undefined) {
      doc.participants = input.participants;
    }
  });
}

/**
 * Input for updating a participant.
 */
export interface UpdateParticipantInput {
  phone?: string;
  personalMode?: boolean;
  avatarId?: PartyParticipant["avatarId"];
  balancesSortedBy?: PartyParticipant["balancesSortedBy"];
  isArchived?: boolean;
}

/**
 * Update a participant's details.
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 * @param participantId - The participant ID
 * @param input - The fields to update
 */
export async function updateParticipant(
  client: ITrizumClient,
  partyId: DocumentId,
  participantId: string,
  input: UpdateParticipantInput,
): Promise<void> {
  const handle = await client.findHandle<Party>(partyId);
  const party = handle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  const participant = party.participants[participantId];
  if (!participant) {
    throw new Error("Participant not found");
  }

  handle.change((doc) => {
    const p = doc.participants[participantId];
    if (!p) return;

    // Handle each field - delete if undefined, set if defined
    if (input.phone !== undefined) {
      if (input.phone === "") {
        delete p.phone;
      } else {
        p.phone = input.phone;
      }
    }

    if (input.personalMode !== undefined) {
      if (input.personalMode === false) {
        delete p.personalMode;
      } else {
        p.personalMode = input.personalMode;
      }
    }

    if (input.avatarId !== undefined) {
      if (input.avatarId === null) {
        delete p.avatarId;
      } else {
        p.avatarId = input.avatarId;
      }
    }

    if (input.balancesSortedBy !== undefined) {
      p.balancesSortedBy = input.balancesSortedBy;
    }

    if (input.isArchived !== undefined) {
      if (input.isArchived === false) {
        delete p.isArchived;
      } else {
        p.isArchived = input.isArchived;
      }
    }
  });
}

/**
 * Add a new participant to a party.
 *
 * @param client - The Trizum client
 * @param partyId - The party document ID
 * @param participantId - The new participant ID
 * @param participant - The participant data
 */
export async function addParticipant(
  client: ITrizumClient,
  partyId: DocumentId,
  participantId: string,
  participant: Omit<PartyParticipant, "id">,
): Promise<void> {
  const handle = await client.findHandle<Party>(partyId);
  const party = handle.doc();

  if (!party) {
    throw new Error("Party not found");
  }

  if (party.participants[participantId]) {
    throw new Error("Participant already exists");
  }

  handle.change((doc) => {
    doc.participants[participantId] = {
      id: participantId,
      ...participant,
    };
  });
}
