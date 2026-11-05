---
"@trizum/pwa": minor
"@trizum/mcp": minor
"@trizum/analytics": minor
---

Add an anonymous ChatGPT app and MCP endpoint for creating shared expense groups,
viewing balances, and recording equally split expenses. Reuse Automerge sync and
existing expense calculations, show an inline group card with a trizum invite
link, and prevent duplicate writes when agents retry requests.

Record anonymous completed MCP action counts through the shared analytics package
without forwarding client identity, request metadata, or group data.

Keep MCP reads off D1, store compact retry receipts, sync existing Automerge
documents on demand, and share analytics bootstrap across actions.

Expire signed write tokens after 15 minutes, clean up compact retry receipts on an
indexed schedule, and bound anonymous writes with Cloudflare's rate limiter.
Explain agent data handling and retention in the public privacy policy.
