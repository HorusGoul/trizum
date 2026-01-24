/**
 * PartyList model - the root document for a user's data.
 *
 * Each user has one PartyList that contains references to all their parties.
 */

import type { DocumentId, SupportedLocale } from "../types.js";
import type { Party, PartyParticipant } from "./party.js";

/**
 * The root document for a user, containing their profile and party references.
 */
export interface PartyList {
  /** Document ID (self-referential) */
  id: DocumentId;
  /** Document type discriminator */
  type: "partyList";
  /** Schema version for migrations (optional, defaults to 0 if missing) */
  __schemaVersion?: number;
  /** User's display name */
  username: string;
  /** User's phone number */
  phone: string;
  /** Profile picture */
  avatarId?: DocumentId | null;
  /** User's preferred locale */
  locale?: SupportedLocale;
  /** Whether to open the last party on app launch */
  openLastPartyOnLaunch?: boolean;
  /** ID of the last opened party */
  lastOpenedPartyId?: DocumentId | null;
  /** Set of party IDs the user owns/has joined */
  parties: Record<Party["id"], true | undefined>;
  /** Mapping of party IDs to the user's participant ID in that party */
  participantInParties: Record<Party["id"], PartyParticipant["id"]>;
}

/**
 * The localStorage key for storing the PartyList document ID.
 */
export const PARTY_LIST_STORAGE_KEY = "partyListId";

/**
 * Input for updating PartyList settings.
 */
export interface UpdatePartyListInput {
  username?: string;
  phone?: string;
  avatarId?: DocumentId | null;
  locale?: SupportedLocale;
  openLastPartyOnLaunch?: boolean;
}
