import type { DocumentId } from "@automerge/automerge-repo/slim";
import type { Party } from "../../models/party.ts";
import type { MigrationData } from "../../models/migrationData.ts";
import type {
  InternalPartyListSeed,
  InternalPartyListSeedResult,
  InternalPartyListSnapshot,
} from "./browserHarness.ts";

export interface BrowserHarnessApi {
  __internal_createPartyFromMigrationData(data: MigrationData): Promise<DocumentId>;
  __internal_createDeferredPartyListState(
    seed: InternalPartyListSeed,
  ): Promise<InternalPartyListSeedResult>;
  __internal_getDocumentState(documentId: DocumentId): string | undefined;
  __internal_releaseDeferredPartyListState(partyListId: DocumentId): void;
  __internal_seedPartyListState(seed: InternalPartyListSeed): Promise<InternalPartyListSeedResult>;
  __internal_readPartyListState(): Promise<InternalPartyListSnapshot>;
  __internal_recalculatePartyBalances(partyId: Party["id"]): Promise<boolean>;
  __internal_setPartyBoost?: (partyId: Party["id"], boost: Party["boost"]) => Promise<void>;
}

declare global {
  interface Window extends BrowserHarnessApi {}
}
