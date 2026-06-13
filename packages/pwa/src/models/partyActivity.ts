import {
  insertAt,
  type DocHandle,
  type DocumentId,
  type Repo,
} from "@automerge/automerge-repo/slim";
import { ulid } from "ulidx";
import { getExpenseTotalAmount, type Expense } from "./expense";
import type {
  Party,
  PartyActivityLog,
  PartyActivityLogEntry,
  PartyActivityLogEntryInput,
  PartyActivityParticipantChange,
  PartyActivitySettingsChange,
  PartyParticipant,
} from "./party";

export function createPartyActivityLogEntry(
  input: PartyActivityLogEntryInput,
): PartyActivityLogEntry {
  return {
    ...input,
    id: ulid(),
    createdAt: new Date(),
  } as PartyActivityLogEntry;
}

export function createPartyActivityLog(
  repo: Repo,
  partyId: Party["id"],
  entries: PartyActivityLogEntryInput[] = [],
) {
  return createPartyActivityLogWithEntries(
    repo,
    partyId,
    entries.map((entry) => createPartyActivityLogEntry(entry)),
  );
}

function createPartyActivityLogWithEntries(
  repo: Repo,
  partyId: Party["id"],
  entries: PartyActivityLogEntry[],
) {
  const handle = repo.create<PartyActivityLog>({
    id: "" as DocumentId,
    type: "partyActivityLog",
    partyId,
    entries,
  });

  handle.change((doc) => (doc.id = handle.documentId));

  return handle;
}

export async function ensurePartyActivityLog(repo: Repo, partyHandle: DocHandle<Party>) {
  const party = partyHandle.doc();

  if (!party) {
    throw new Error("Party not found, this should not happen");
  }

  if (party.activityLogId) {
    const existingHandle = await repo.find<PartyActivityLog>(party.activityLogId);

    if (existingHandle.doc()) {
      return existingHandle;
    }
  }

  const legacyEntries = party.activityLog ? [...party.activityLog] : [];
  const logHandle = createPartyActivityLogWithEntries(repo, party.id, legacyEntries);

  partyHandle.change((doc) => {
    doc.activityLogId = logHandle.documentId;
    delete doc.activityLog;
  });

  return logHandle;
}

export async function appendPartyActivityLogEntry(
  repo: Repo,
  partyHandle: DocHandle<Party>,
  input: PartyActivityLogEntryInput,
) {
  await appendPartyActivityLogEntries(repo, partyHandle, [input]);
}

export async function appendPartyActivityLogEntries(
  repo: Repo,
  partyHandle: DocHandle<Party>,
  inputs: PartyActivityLogEntryInput[],
) {
  if (inputs.length === 0) {
    return;
  }

  const logHandle = await ensurePartyActivityLog(repo, partyHandle);

  logHandle.change((doc) => {
    for (const input of [...inputs].reverse()) {
      insertAt(doc.entries, 0, createPartyActivityLogEntry(input));
    }
  });
}

export function createExpenseActivityLogEntry(
  type: "expense-added" | "expense-updated" | "expense-removed",
  expense: Expense,
): PartyActivityLogEntryInput {
  return {
    type,
    expenseId: expense.id,
    expenseName: expense.name,
    amount: getExpenseTotalAmount(expense),
  };
}

export function getPartySettingsActivityEntries(
  previous: Pick<Party, "name" | "symbol" | "description" | "participants">,
  next: Pick<Party, "name" | "symbol" | "description" | "participants">,
): PartyActivityLogEntryInput[] {
  const entries: PartyActivityLogEntryInput[] = [];
  const settingsChanges: PartyActivitySettingsChange[] = [];

  if (previous.name !== next.name) {
    settingsChanges.push("name");
  }

  if ((previous.symbol ?? "") !== (next.symbol ?? "")) {
    settingsChanges.push("symbol");
  }

  if (previous.description !== next.description) {
    settingsChanges.push("description");
  }

  if (settingsChanges.length > 0) {
    entries.push({
      type: "party-settings-updated",
      changes: settingsChanges,
    });
  }

  for (const participant of Object.values(next.participants)) {
    const previousParticipant = previous.participants[participant.id];

    if (!previousParticipant) {
      entries.push({
        type: "participant-added",
        participantId: participant.id,
        participantName: participant.name,
      });
      continue;
    }

    const participantChanges = getParticipantActivityChanges(previousParticipant, participant);

    if (participantChanges.length > 0) {
      entries.push({
        type: "participant-updated",
        participantId: participant.id,
        participantName: participant.name,
        changes: participantChanges,
      });
    }

    if (!previousParticipant.isArchived && participant.isArchived) {
      entries.push({
        type: "participant-archived",
        participantId: participant.id,
        participantName: participant.name,
      });
    }

    if (previousParticipant.isArchived && !participant.isArchived) {
      entries.push({
        type: "participant-restored",
        participantId: participant.id,
        participantName: participant.name,
      });
    }
  }

  for (const participant of Object.values(previous.participants)) {
    if (next.participants[participant.id]) {
      continue;
    }

    entries.push({
      type: "participant-removed",
      participantId: participant.id,
      participantName: participant.name,
    });
  }

  return entries;
}

export function getParticipantActivityChanges(
  previous: PartyParticipant,
  next: PartyParticipant,
): PartyActivityParticipantChange[] {
  const changes: PartyActivityParticipantChange[] = [];

  if (previous.name !== next.name) {
    changes.push("name");
  }

  if ((previous.phone ?? "") !== (next.phone ?? "")) {
    changes.push("phone");
  }

  if ((previous.avatarId ?? null) !== (next.avatarId ?? null)) {
    changes.push("avatar");
  }

  return changes;
}
