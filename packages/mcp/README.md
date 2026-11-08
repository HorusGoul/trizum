# trizum MCP and ChatGPT app

An anonymous MCP Apps integration for creating expense groups, viewing balances,
recording and editing expenses, and managing people as the group grows. It uses trizum's
shared-link access model: anyone with a party link can access and edit that party. Creation does not send invitations or
attach a party to an account. Open its invite link in trizum and choose your
participant to join through the normal PWA flow.

## Structure

- [`src/contracts.ts`](./src/contracts.ts): validated tool inputs, structured
  results, and the host's `McpService` interface.
- [`src/server.ts`](./src/server.ts): tools and UI resource, using the official
  MCP SDK's fetch-native Streamable HTTP transport.
- [`src/widget.tsx`](./src/widget.tsx): React card built with `@trizum/ui` and
  the standard MCP Apps bridge. Other MCP clients can use structured results without rendering UI.
- [`../pwa/api/routes/mcp.ts`](../pwa/api/routes/mcp.ts): `/api/mcp` in the
  existing Cloudflare Worker, with no separate hosting.
- [`../pwa/api/mcp`](../pwa/api/mcp): existing Automerge domain and D1 adapters.

The package uses the shared `@trizum/ui` design system. Its host supplies
persistence and Lingui UI labels; it has no PWA dependency. Protocol descriptions guide agents in English; widget labels support
English and Spanish through the Worker's `Accept-Language` or `?lang=es` setting.

## Tools and scope

| Tool                 | Purpose                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `prepare_write`      | Issue a signed, 15-minute request token for one party, participant, or expense action.      |
| `create_party`       | Create a named group with a currency and 1–50 named participants; return its invite URL.    |
| `get_party`          | Sync a known party's participants, shared balances, and up to 20 recent expenses on demand. |
| `add_participants`   | Add named people to a party and return their IDs for subsequent expenses.                   |
| `add_expense`        | Record a paid expense with one payer, split equally among selected participants.            |
| `get_expense`        | Read a specific expense's payer amounts, split rules, and version before changing it.       |
| `update_party`       | Change the group name, description, or symbol without replacing other fields.               |
| `update_participant` | Rename, archive, or restore a participant while retaining their ID and history.             |
| `update_expense`     | Edit specified expense fields using a current version.                                      |
| `delete_expense`     | Delete one explicitly requested expense using a current version.                            |

The agent resolves participant IDs from `get_party` and asks about missing
details. If an expense clearly introduces a new person, it can call
`add_participants` first and use the returned IDs in `add_expense`. Ambiguous
names or intent require clarification. The tool adds up to 50 people per batch,
with a 50-participant total guard including archived people. This guard uses the
request’s current Automerge state; simultaneous batches can exceed it as their
edits merge. It rejects names already present in its current snapshot and duplicate names within a batch,
ignoring case and surrounding whitespace. Independently prepared concurrent
actions can still introduce the same display name; names are not globally unique
identities, so agents must resolve ambiguous matches rather than guess.

Participant additions preserve existing IDs, details, balances, and old expense
splits. They merge individual participant entries instead of replacing the party's
participant map, so concurrent additions of different people survive.
`update_participant` renames people or archives/restores them. Removing an existing
person means archiving, matching the PWA; previous expenses and debts retain the
same participant ID. It checks that another active person remains in the current
snapshot. As with other offline edits, simultaneous updates merge through
Automerge rather than a global database lock.

Decimal strings such as `"24.50"` become integer hundredths, matching
trizum's two-decimal convention for every currency. Balances, rounding, and
expense hashes use the existing domain model. Positive balances mean money is
owed to that person; negative balances mean they owe money.

This version excludes account discovery, contacts, notifications, payments,
attachment editing, currency changes/conversion, custom-split creation,
and transfer editing/deletion. Reads are bounded to 100 expense chunks and 1,000 expenses per existing chunk; larger
parties must be opened in trizum.

## Editing existing data

Party updates change only supplied name, description, and symbol fields. Currency
is fixed. Participant updates change only the named participant's display name
and/or archive state; they never replace the shared participant map.

For an expense edit or deletion, resolve the exact expense ID from recent results
or a user-provided link, then call `get_expense`. It reads only that expense's
owning chunk, verifies the chunk belongs to the supplied party, and returns the
current content hash as `version`. Include that version in the mutation. A
request that observes a different version refuses the write and asks for a fresh
read. Concurrent requests still use normal Automerge field merge semantics;
this is not a global compare-and-swap lock.

`update_expense` patches only supplied fields using the PWA's expense diff/hash
helpers, retaining the ID, photos, and unspecified fields. Names and dates can
be changed on custom-split or multi-payer expenses. Financial edits support one
payer and equal sharing: an existing custom split or multiple payers require
explicit user instructions and both the replacement payer and split list. No
split is silently converted. Transfers stay in trizum so paired settlement
records are not broken.

`delete_expense` removes exactly the requested record and its balance impact.
Deleting the last record leaves its normal empty chunk in place. Destructive
annotations identify update/delete tools, and agent instructions require clear
user intent, disambiguation, and current versions.

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

Initialization, discovery, resource reads, `prepare_write`, `get_party`, and `get_expense`
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
`add_participants` changes only the party document, followed by the normal
on-demand group view. It creates no extra documents or summaries and uses the
same two D1 write statements and retry protection as other mutations.
Expense edits and deletions recompute the affected chunk's existing shared
balance document by calling the existing PWA `recalculatePartyBalances` through
a Worker adapter scoped to that chunk. Browser hooks, shared models, and the
PWA recalculation implementation stay unchanged. Fresh, temporary sync repos
verify the projection after each write so a delayed request does not leave its
older balance snapshot behind. Reconciliation also corrects the edited record's
content hash after concurrent field merges. It stops after four passes and shares
the original request deadline; unresolved contention is reported as unconfirmed,
not repeated as a new action. The returned party view comes from a fresh sync.
This adds bounded Automerge connections/reads and balance writes for existing
expense changes, with no extra D1 queries, new persistent fields, or MCP cache.
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

The build emits server code/declarations plus `dist/widget.js`, `dist/widget.css`,
and `dist/widget.svg`. These are generated files. The widget imports shared UI
styles and uses Button (including its async pending state), Avatar, Alert, Icon,
and UIProvider. Its icon sprite is generated with the UI package’s icon helper.
Lingui loads the UI package’s English/Spanish catalogs alongside host-supplied
labels; the host’s initial theme and theme changes select the shared light/dark
styles. The document uses the shared trizum light/dark background colors and the
host’s outer frame, with no nested card border or surface. Content owns its
responsive inset so host height measurements include the bottom spacing. The MCP HTML embeds scripts,
CSS, fonts, and the sprite, so the sandbox
needs no network access for rendering. Worker tasks build this package before
importing its server and raw widget assets.

The widget build embeds the Latin subset of the shared fonts for the supported
English/Spanish UI; other scripts use the platform font fallback. A built-asset
test enforces a 768 KiB HTML budget. This is a project payload budget, not a
verified ChatGPT mobile size limit. Published resource URLs remain registered as
compatibility aliases so cached tool definitions can still read the card after
an update. New tool metadata advertises the latest URI.

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
- Growing group: after creating Alice/Bob's group, “Carol paid €12 for lunch;
  split it among Alice, Bob, and Carol.” Expect Carol to be added, then the expense
  to use her returned ID. Previous expenses keep their original splits. Ask for
  clarification if a name could refer to an existing participant.
- Participant retry: replay `add_participants` unchanged. Expect the same people
  and IDs, with no second addition or analytics event.
- Indirect: “My partner and I want to track groceries together.” Expect
  clarification about names, group name, and currency before creation.
- Retry: replay a completed call unchanged within 15 minutes. Expect the same
  party with its current state and no additional group or expense. After expiry,
  expect rejection even if its receipt has been deleted.
- Details: “Rename this group to Summer trip and clear its description.” Expect
  only those fields to change.
- Participant: “Rename Bob to Robert, then remove him from the active group.”
  Expect the same ID, archived state, and unchanged previous splits/debts.
  “Restore Robert” must reactivate that same person.
- Edit: “Change dinner to €12.” Expect the exact record to be read and updated
  with a current version. Preserve photos, payer, and split unless requested.
- Delete: “Delete that dinner expense.” Expect one deletion and updated balances.
  Replaying it must not delete another record. Ambiguous expense names require
  clarification; stale versions require a fresh read.
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

## Acquisition handoff

Every returned party URL uses the canonical `https://trizum.app/party/<id>` path and adds
`entry=ai&utm_source=mcp&utm_medium=ai_app&utm_campaign=party_handoff`.
Browser visitors see `/party/<id>/continue`, with platform-appropriate App Store
or Google Play links, a desktop invite QR code, a copyable invite, and a web
continuation. Continuing uses the existing participant selection and party route.
The page reads only the party document; it does not load expense history or add
membership before the visitor chooses to join. Installed native apps retain the
existing invite behavior, including apps released before this entry flag.

The entry flag controls the page independently of attribution. The shared
analytics package accepts only approved campaign labels, under existing browser
privacy gates. Generic MCP results identify the source as `mcp`; they do not
claim a specific host. Store clicks are requests, not measured installs. There is
no short-link database, server-side campaign state, or deferred-install lookup;
users reopen the original invite after installing. Ordinary PWA share links are
unchanged.

### Installed-app dispatch

`trizum.app` remains the native-associated domain. An installed app receives the
canonical invite directly and skips download choices. For browser visits,
production AI entries redirect to `join.trizum.app/party/<id>/continue`, hosted by
the same Worker. The handoff's app link points directly back to `trizum.app`,
which avoids Safari's same-domain universal-link navigation behavior without
changing native entitlements or requiring existing users to update the app.
Preview handoff pages use the canonical native target too. MCP responses always
return the canonical app-associated origin, including calls through preview or
Worker aliases. This lets installed apps open directly from ChatGPT. To test the
new browser handoff before production deployment, replace only the invite's
origin with the PR preview origin; production URLs use the deployed production
frontend until release.

The web choice returns to the canonical party route without `entry=ai`, carrying
only approved UTM labels. Copied production invites also remain canonical. The
redirect reads no party data and never forwards arbitrary query fields. The
handoff and web app have separate origin-local profiles, so campaign labels
support aggregate funnel reports, not cross-origin visitor identity matching.
The new custom domain must be active before enabling the production redirect;
preview deployment does not provision production routes. See the Worker setup.

If a new party's write acknowledgement is lost after a document ID is allocated,
the tool remains an error and returns that party's recovery link. Check it with
`get_party` before considering another creation. The link is not proof that the
write succeeded. The original retry claim stays pending; no extra D1 operation
or receipt is written merely to expose the known document ID.
