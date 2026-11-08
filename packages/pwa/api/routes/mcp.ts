import { Hono } from "hono";
import { NATIVE_APP_ORIGIN } from "../../src/lib/aiInvite";
import { bodyLimit } from "hono/body-limit";
import { handleMcpRequest } from "@trizum/mcp/index";
import widgetScript from "@trizum/mcp/widget.js?raw";
import widgetStyles from "@trizum/mcp/widget.css?raw";
import widgetSprite from "@trizum/mcp/widget.svg?raw";
import { createAutomergeDocumentsMiddleware } from "../automergeDocumentsMiddleware";
import { WorkerPartyService } from "../mcp/partyService";
import { IdempotentPartyService } from "../mcp/idempotency";
import { createMcpAnalytics } from "../mcp/analytics";
import { WriteTokens } from "../mcp/writeTokens";
import { createMcpWriteLimit } from "../mcp/writeLimit";
import {
  mcpBalancesMessage,
  mcpErrorMessage,
  mcpExpensesMessage,
  mcpOpenMessage,
  mcpOpenErrorMessage,
} from "../../src/lib/mcpMessages";
import type { ApiHonoEnv } from "../env";

export const mcpRoute = new Hono<ApiHonoEnv>();

// Browser requests must originate at this server or the supported ChatGPT hosts.
// Native MCP clients send no Origin. This does not confer party authorization.
mcpRoute.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const allowed = [new URL(c.req.url).origin, "https://chatgpt.com", "https://chat.openai.com"];
  c.header("Cache-Control", "no-store");

  if (origin && !allowed.includes(origin)) return c.json({ error: "Origin not allowed" }, 403);

  await next();
  c.header("Cache-Control", "no-store");

  if (origin) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
  }
});

mcpRoute.options("/", (c) => {
  c.header("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
  );

  return c.body(null, 204);
});

mcpRoute.use("*", bodyLimit({ maxSize: 64 * 1024 }));

mcpRoute.use("*", createAutomergeDocumentsMiddleware());

mcpRoute.on(["POST", "GET", "DELETE"], "/", (c) => {
  const i18n = c.get("i18n");

  const service = new IdempotentPartyService(
    new WorkerPartyService(c.get("documents"), NATIVE_APP_ORIGIN),
    c.env.DB,
    {
      tokens: new WriteTokens(c.env.BETTER_AUTH_SECRET),
      limitWrite: createMcpWriteLimit(c.env, c.req.raw),
      trackEvent: createMcpAnalytics(c.env, c.req.raw, (task) => c.executionCtx.waitUntil(task)),
    },
  );

  return handleMcpRequest(c.req.raw, service, {
    appOrigin: new URL(c.req.url).origin,
    widgetScript,
    widgetStyles,
    widgetSprite,
    locale: c.get("locale"),
    openLabel: i18n._(mcpOpenMessage),
    openErrorLabel: i18n._(mcpOpenErrorMessage),
    expensesLabel: i18n._(mcpExpensesMessage),
    balancesLabel: i18n._(mcpBalancesMessage),
    errorLabel: i18n._(mcpErrorMessage),
  });
});
