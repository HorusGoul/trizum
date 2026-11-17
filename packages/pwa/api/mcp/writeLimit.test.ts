import { expect, it, vi } from "vite-plus/test";
import { createMcpWriteLimit } from "./writeLimit";

it("applies the edge binding to write attempts with separate preview and production counters", async () => {
  const limit = vi.fn<RateLimit["limit"]>().mockResolvedValue({ success: true });
  const env = { MCP_WRITE_LIMITER: { limit } };
  const headers = { "CF-Connecting-IP": "192.0.2.1", "X-Forwarded-For": "caller-controlled" };
  await createMcpWriteLimit(env, new Request("https://trizum.app/api/mcp", { headers }))();
  await createMcpWriteLimit(env, new Request("https://preview.workers.dev/api/mcp", { headers }))();
  expect(limit.mock.calls).toEqual([
    [{ key: "mcp-write:trizum.app:192.0.2.1" }],
    [{ key: "mcp-write:preview.workers.dev:192.0.2.1" }],
  ]);
  limit.mockResolvedValueOnce({ success: false });
  await expect(
    createMcpWriteLimit(env, new Request("https://trizum.app/api/mcp", { headers }))(),
  ).rejects.toThrow("Too many write requests");
});

it("fails closed for writes if the edge protection binding is missing", async () => {
  await expect(
    createMcpWriteLimit({}, new Request("https://trizum.app/api/mcp"))(),
  ).rejects.toThrow("not configured");
});
