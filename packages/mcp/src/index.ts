export { createMcpServer, handleMcpRequest } from "./server.js";

export { McpToolError } from "./contracts.js";

export type {
  McpService,
  PartyService,
  PartyView,
  CreatePartyInput,
  AddExpenseInput,
  AddParticipantsInput,
  PrepareWriteInput,
  PreparedWrite,
  WriteOperation,
  GetExpenseInput,
  ExpenseView,
  UpdatePartyInput,
  UpdateParticipantInput,
  UpdateExpenseInput,
  DeleteExpenseInput,
  PartyWriteInput,
} from "./contracts.js";
