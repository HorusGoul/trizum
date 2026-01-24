/**
 * SDK React hook for party list management.
 *
 * Provides access to the user's party list and operations.
 */

import { useTrizumClient } from "../TrizumProvider.js";
import { useSuspenseDocument } from "../suspense-hooks.js";
import type { DocumentId } from "../../types.js";
import type { PartyList, UpdatePartyListInput } from "../../models/party-list.js";

/**
 * Result of usePartyList hook.
 */
export interface UsePartyListResult {
  /** The party list document */
  partyList: PartyList;
  /** Add a party to the user's list */
  addPartyToList: (partyId: DocumentId, participantId: string) => Promise<void>;
  /** Remove a party from the user's list */
  removeParty: (partyId: DocumentId) => Promise<void>;
  /** Set the last opened party */
  setLastOpenedPartyId: (partyId: DocumentId | null) => Promise<void>;
  /** Update user settings (syncs to all parties) */
  updateSettings: (input: UpdatePartyListInput) => Promise<void>;
}

/**
 * Hook for managing the user's party list.
 *
 * Provides access to the user's collection of parties they belong to,
 * along with operations for adding/removing parties and updating user settings.
 *
 * @example
 * ```tsx
 * function PartyListView() {
 *   const { partyList, removeParty } = usePartyList();
 *
 *   return (
 *     <ul>
 *       {Object.keys(partyList.parties).map((partyId) => (
 *         <li key={partyId}>
 *           {partyId}
 *           <button onClick={() => removeParty(partyId as DocumentId)}>
 *             Leave
 *           </button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function usePartyList(): UsePartyListResult {
  const client = useTrizumClient();
  const partyListId = client.partyList.getOrCreate();
  const [partyList] = useSuspenseDocument<PartyList>(partyListId, { required: true });

  return {
    partyList,

    addPartyToList: (partyId, participantId) =>
      client.partyList.addParty(partyId, participantId),

    removeParty: (partyId) => client.partyList.removeParty(partyId),

    setLastOpenedPartyId: (partyId) => client.partyList.setLastOpened(partyId),

    updateSettings: (input) => client.partyList.updateSettings(input),
  };
}
