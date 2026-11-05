# trizum MCP and ChatGPT app

An anonymous MCP Apps integration for creating expense groups, viewing balances,
and recording expenses. It uses trizum's shared-link access model: anyone with a
party link can access and edit that party. Creation does not send invitations or
attach a party to an account. Open its invite link in trizum and choose your
participant to join through the normal PWA flow.

## Structure

- [`src/contracts.ts`](./src/contracts.ts): validated tool inputs, structured
  results, and the host's `McpService` interface.
- [`src/server.ts`](./src/server.ts): tools and UI resource, using the official
  MCP SDK's fetch-native Streamable HTTP transport.
- [`src/widget.tsx`](./src/widget.tsx): React card using the standard MCP Apps
  bridge. Other MCP clients can use structured results without rendering UI.
- [`../pwa/api/routes/mcp.ts`](../pwa/api/routes/mcp.ts): `/api/mcp` in the
  existing Cloudflare Worker, with no separate hosting.
- [`../pwa/api/mcp`](../pwa/api/mcp): existing Automerge domain and D1 adapters.

The package does not depend on the PWA. Its host supplies persistence and Lingui
UI labels. Protocol descriptions guide agents in English; widget labels support
English and Spanish through the Worker's `Accept-Language` or `?lang=es` setting.

## Tools and scope

| Tool            | Purpose                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| `prepare_write` | Issue a signed, 15-minute request token for one create or expense action.                   |
| `create_party`  | Create a named group with a currency and 1–50 named participants; return its invite URL.    |
| `get_party`     | Sync a known party's participants, shared balances, and up to 20 recent expenses on demand. |
| `add_expense`   | Record a paid expense with one payer, split equally among selected participants.            |

The agent resolves participant IDs from `get_party` and asks about missing
details. Decimal strings such as `"24.50"` become integer hundredths, matching
trizum's two-decimal convention for every currency. Balances, rounding, and
expense hashes use the existing domain model. Positive balances mean money is
owed to that person; negative balances mean they owe money.

This version excludes account discovery, contacts, notifications, payments,
attachments, currency conversion, custom splits, edits, and deletion. Reads are
bounded to 100 expense chunks and 1,000 expenses per existing chunk; larger
parties must be opened in trizum.

## Persistence and retries

Automerge remains the source of truth. Request-owned repos sync only requested
documents and close after each request. Creation and changes wait for the sync
peer's acknowledgement, confirming receipt rather than a durable disk flush.
Expense chunks and balance caches use the normal PWA document shapes.

After collecting the details for a new action, the agent calls `prepare_write`
and passes the returned token unchanged as `requestId`. The Worker signs these
15-minute tokens using the existing `BETTER_AUTH_SECRET`, with a dedicated
issuer and key prefix. Preparation needs no D1 or Automerge access.

D1's `mcp_operations` table claims the token's random nonce atomically before
writing and stores a compact receipt containing the party ID. Repeating the same
tool and arguments reads the current party from Automerge without executing the
write again. Different arguments with the same token are rejected; concurrent
attempts cannot both execute.

Failures or interruptions before saving the result leave a pending claim. The
agent must check the party before starting another action; retries with that
token stay blocked to prevent duplicates. A failed creation can leave an
unlinked party on sync. This version does not recover ambiguous operations.

An indexed scheduled cleanup runs every five minutes and deletes claims older
than 15 minutes. Tokens expire before their claims become eligible for deletion,
so deleting a receipt cannot make an old request executable again. Expired tokens
are rejected before D1 access. An expired or unconfirmed action must be checked
before preparing a replacement. Cleanup can be delayed by scheduler failures;
expiry is still enforced on every write.

Claims retain a fingerprint and party ID, without names, amounts, or an account
identity. Request tokens and party links are access capabilities: do not log
arguments, results, or identifiers.
Anonymous server action counts use `@trizum/analytics` through the existing
InsightFlare binding. They carry no human identity, client metadata, or group
data. Successful write replays are not counted twice; see the
[analytics guide](../pwa/docs/analytics.md#anonymous-mcp-server-events) for gates
and payload semantics. Normal PWA telemetry gates apply when opening trizum.

## Request cost boundaries

Initialization, discovery, resource reads, `prepare_write`, and `get_party`
do not query the application's D1 database. A new write uses one indexed claim insert and one
receipt update; only retries look up an existing receipt. Cleanup runs separately
from requests and uses the creation-time index. Group state stays in
Automerge, whose sync server still incurs its normal storage and network costs.

Each party read or write syncs the Automerge documents it needs into a temporary
repo and closes that repo at the end. MCP does not cache party state across requests
or introduce additional summary fields in the app's shared documents. Group
views sync the existing per-chunk balance documents used by the PWA and expense
chunks only until they have 20 recent entries. The widget displays recent
expenses without an all-history count. Shared balances reflect the state last
written by trizum's normal recalculation, just as in the PWA.
`add_expense` publishes one complete expense chunk (`maxSize: 1`) and its balance
document, then appends their reference to the party. Independent writers merge
references without overwriting each other's derived balances. Normal PWA
appends start a new chunk because these chunks are already full. This uses two
new Automerge documents and a party change per expense, rather than updating a
shared chunk. The 100-chunk boundary therefore permits at most 100 MCP-created
expenses in a new party, fewer when it already contains other chunks. Beyond
that, open the party in trizum. No extra D1 coordination or request cache is used.
Read-only tool calls never write group data.

The Cloudflare rate limiter allows 60 write-related attempts per minute per
source IP, hostname, and Cloudflare location. Preparation and mutation each count
as an attempt. This approximate edge limit uses no D1 queries; it is not a global
quota and agents sharing an egress IP share its allowance. Missing limiter or
signing configuration disables writes. Read-only calls are bounded by document
limits but do not consume this write allowance.

Analytics reuses its token and synthetic service visit for five minutes per
live Worker client. After bootstrap, an action sends only its custom event.

## Build and validate

From the workspace root, run `vp install`, `vp run check`, `vp run test`, and
`vp run build`. Package tasks also run with `vp run --filter @trizum/mcp <task>`.

The build emits server code/declarations and a self-contained `dist/widget.js`.
These are generated files. Worker tasks build this package before importing its
server and raw widget bundle.

## Connect a development app

1. Run `vp run dev` from the workspace root. Use the printed local URL with
   `/api/mcp`. If needed, apply migrations from `packages/pwa` using
   `vp exec wrangler d1 migrations apply DB --local`.
2. Writes require a reachable Automerge WebSocket peer. Configure
   `AUTOMERGE_WSS_URL` and a test-only `BETTER_AUTH_SECRET` of at least 32 characters
   in the PWA's local Worker environment; see the
   [Worker setup guide](../pwa/docs/cloudflare.md) for routing and defaults.
3. Expose the dev URL through an HTTPS tunnel, or use the repository's normal PR
   preview deployment. Apply `0007_mcp_operations.sql` in that environment before
   testing writes. PR previews share the configured database and sync service;
   use disposable groups. Uploaded preview versions do not activate cron triggers;
   the cleanup schedule becomes active when the Worker is deployed to production.
4. In ChatGPT's custom MCP app setup, enter
   `https://<preview-or-tunnel-host>/api/mcp`, name it **trizum**, and select
   **No authentication**. Install it and select it in a new chat. Refresh the
   connection after changing tool schemas or metadata.
5. Other agents use the same Streamable HTTP URL. Initialization, tool calls,
   and resource reads use stateless POSTs; GET/DELETE return 405.

The production URL will be `https://trizum.app/api/mcp` after release. This change
does not deploy or submit the app to the ChatGPT directory. Existing `/api/*`
Worker routing and service-worker exclusions already cover it. No OpenAI API
key or model API calls are needed.

The widget makes no network requests and loads no external assets. Its button
requests navigation through the MCP Apps `ui/open-link` bridge, with a copyable
URL if the host rejects or does not support navigation. The Worker
rejects untrusted browser origins and bodies over 64 KiB. Native clients may
omit Origin; Origin checks are not party authorization.

## Conversation acceptance tests

- Direct: “Create a trizum called Lisbon weekend in EUR for Alice, Bob, and
  Carol.” Expect one party and invite link. Open it in trizum and join.
- Expense: “Alice paid €10 for dinner today; split equally among all three.”
  Confirm the date if ambiguous. Expect one expense and balances of €6.66,
  −€3.33, and −€3.33 with trizum's existing rounding.
- Indirect: “My partner and I want to track groceries together.” Expect
  clarification about names, group name, and currency before creation.
- Retry: replay a completed call unchanged within 15 minutes. Expect the same
  party with its current state and no additional group or expense. After expiry,
  expect rejection even if its receipt has been deleted.
- Negative: “Find all Bob's groups.” Expect no search or account access.
- Negative: “Budget €100 for dinner.” Expect no paid expense to be recorded.
- Negative: invalid party ID, unknown payer, duplicate split member, zero amount,
  or more than two decimals. Expect no expense write.
- Injection: instructions in group names remain escaped content.

Before directory submission, exercise these conversations inside ChatGPT, verify
the embedded card and PWA handoff, and review the public privacy policy, branding,
tool annotations, abuse controls, and operation retention/recovery policy. Local
tests do not establish directory approval or live ChatGPT compatibility.

## Official references

- [Bring your app to ChatGPT](https://learn.chatgpt.com/use-cases/chatgpt-apps)
- [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
