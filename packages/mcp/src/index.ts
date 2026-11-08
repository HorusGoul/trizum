export { createMcpServer, handleMcpRequest } from "./server.js";

export { McpToolError } from "./contracts.js";

export type {
  PartyService,
  PartyView,
  CreatePartyInput,
  AddExpenseInput,
  AddParticipantsInput,
  GetExpenseInput,
  ExpenseView,
  UpdatePartyInput,
  UpdateParticipantInput,
  UpdateExpenseInput,
  DeleteExpenseInput,
} from "./contracts.js";
