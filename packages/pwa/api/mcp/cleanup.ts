import { WRITE_WINDOW_MS } from "./writeTokens";

/** Only the scheduled handler invokes this indexed cleanup, never an MCP request. */
export async function cleanupMcpOperations(db: D1Database, now = Date.now()) {
  const cutoff = new Date(now - WRITE_WINDOW_MS).toISOString().slice(0, 19).replace("T", " ");

  const result = await db
    .prepare("DELETE FROM mcp_operations WHERE created_at < ?")
    .bind(cutoff)
    .run();

  return result.meta.changes;
}
