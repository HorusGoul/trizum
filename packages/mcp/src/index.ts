export { createMcpServer, handleMcpRequest } from "./server.js";

export { McpToolError } from "./contracts.js";

export type {
  McpService,
  PartyService,
  PartyView,
  CreatePartyInput,
  AddExpenseInput,
  PrepareWriteInput,
  PreparedWrite,
  WriteOperation,
} from "./contracts.js";
