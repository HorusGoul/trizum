import type { Transport } from "@nkzw/fate";
import type { JazzFateRepository, TrizumFateListRoot } from "./repository";
import type {
  CreateExpenseMutationInput,
  CreateParticipantMutationInput,
  CreatePartyMutationInput,
  ExpenseEntity,
  ParticipantEntity,
  PartyEntity,
  TrizumFateTypename,
} from "./views";

export type TrizumFateMutationMap = {
  "party.create": {
    input: CreatePartyMutationInput;
    output: PartyEntity;
  };
  "participant.create": {
    input: CreateParticipantMutationInput;
    output: ParticipantEntity;
  };
  "expense.create": {
    input: CreateExpenseMutationInput;
    output: ExpenseEntity;
  };
};

export function createJazzFateTransport(
  repository: JazzFateRepository,
): Transport<TrizumFateMutationMap> {
  return {
    fetchById(type, ids, select, args) {
      return repository.fetchEntities(assertTypename(type), ids, select, normalizeArgs(args));
    },

    fetchList(root, select, args) {
      return repository.fetchList(assertListRoot(root), select, normalizeArgs(args));
    },

    async mutate(proc, input, select) {
      switch (proc) {
        case "party.create":
          return (await repository.createParty(
            input as CreatePartyMutationInput,
            select,
          )) as TrizumFateMutationMap[typeof proc]["output"];
        case "participant.create":
          return (await repository.createParticipant(
            input as CreateParticipantMutationInput,
            select,
          )) as TrizumFateMutationMap[typeof proc]["output"];
        case "expense.create":
          return (await repository.createExpense(
            input as CreateExpenseMutationInput,
            select,
          )) as TrizumFateMutationMap[typeof proc]["output"];
        default:
          throw new Error(`Unsupported Fate mutation: ${String(proc)}`);
      }
    },
  };
}

function assertTypename(type: string): TrizumFateTypename {
  if (type === "Party" || type === "Participant" || type === "Expense") {
    return type;
  }

  throw new Error(`Unsupported Fate entity type: ${type}`);
}

function assertListRoot(root: string): TrizumFateListRoot {
  if (root === "parties" || root === "participants" || root === "expenses") {
    return root;
  }

  throw new Error(`Unsupported Fate list root: ${root}`);
}

function normalizeArgs(args: unknown): Record<string, unknown> | undefined {
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }

  return undefined;
}
