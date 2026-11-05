import { McpToolError } from "@trizum/mcp/index";
import type { ApiEnv } from "../env";

export function createMcpWriteLimit(env: Pick<ApiEnv, "MCP_WRITE_LIMITER">, request: Request) {
  // Cloudflare overwrites this header at the public edge. Never trust forwarded
  // addresses supplied by the caller or log the short-lived counter key.
  const key = `mcp-write:${new URL(request.url).hostname}:${request.headers.get("CF-Connecting-IP") ?? "local"}`;

  return async () => {
    if (!env.MCP_WRITE_LIMITER)
      throw new McpToolError("Write protection is not configured. Please try again later.");
    const { success } = await env.MCP_WRITE_LIMITER.limit({ key });

    if (!success) throw new McpToolError("Too many write requests. Please try again in a minute.");
  };
}
