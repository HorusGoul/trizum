# Cloud account deletion

The signed-in **Settings → Cloud Sync → Delete account** flow uses Better Auth's
`POST /api/auth/delete-user`. Better Auth validates the session and requires a
fresh sign-in (or valid password) before running `beforeDelete`. The hook uses
only the authenticated user's immutable ID, which is also the RevenueCat App
User ID. Neither a request body ID nor an email selects the customer.

## Cleanup and retry boundary

Before deleting any cloud account data, the Worker calls RevenueCat v2
`DELETE /projects/{project_id}/customers/{customer_id}` using its secret key.
This applies to every account, including accounts that have never bought
Premium: a native sign-in can create a RevenueCat customer without a purchase.
There is no sandbox filter; deletion covers the customer's sandbox and
production data.

- HTTP 200 with the documented deletion response means RevenueCat **queued**
  deletion. It does not establish when erasure finishes.
- HTTP 404 is accepted only when the error identifies the missing `customer_id`.
  An unknown project or an ambiguous 404 does not count as cleanup.
- Missing configuration, permission errors, rate limits, conflicts, network
  errors, malformed responses, and a 10-second timeout stop cloud deletion with
  a retryable user-facing error. The account, sign-in methods, sessions, settings,
  and stable customer ID remain available. Retry later through the same flow;
  sign in again if the session is no longer fresh. There is no automatic retry
  loop, queue, or manual support workflow in trizum. An outage therefore delays
  account deletion until the user retries successfully.
- A lost RevenueCat response can mean cleanup was accepted even though trizum
  reports failure. Repeating the request for the same ID is safe: another
  acknowledgement or a customer-specific 404 lets deletion proceed.
- Only after RevenueCat accepts the request does Better Auth delete the local
  account. These are not a distributed transaction. A subsequent D1 failure
  cannot undo the remote request; Premium data may be removed even if local
  deletion fails. Better Auth's local deletion uses multiple statements, so a
  database failure can also leave partially deleted local auth data. This PR
  does not replace that existing local deletion mechanism.

## Data scope

Successful cloud deletion removes the D1 user profile, sessions, linked sign-in
accounts (including stored credentials/tokens), cloud settings/document pointer,
and owned Party Boost database assignments. RevenueCat queues deletion of the
customer and its purchase history/attributes, including associated aliases.

It does **not** delete local Automerge data, group lists or shared documents on
sync servers, expenses, receipts, participants, other participants' copies, or
historical CRDT data. Cached boost entries in shared documents may remain until
reconciliation. This flow makes no Automerge writes and does not contact the
sync server. It does not erase unrelated analytics, operational logs, backups,
or store records, and establishes no retention deadline for them. Existing auth
verification records have their own expiry/cleanup lifecycle.

Apple and Google subscriptions are **not canceled** by RevenueCat customer
deletion. Users must manage active subscriptions in the store; this flow does
not request cancellation or refunds. RevenueCat Billing subscriptions have
different deletion semantics (immediate cancellation), but trizum currently
sells Premium through Apple/Google, not RevenueCat Billing.

## Identity, aliases, and restoration limits

The native SDK configures/logs in with the stable trizum ID. Switching between
identified IDs does not merge them under RevenueCat's documented behavior.
RevenueCat treats aliases as one customer; the deletion endpoint removes that
customer, not an individual alias. Keep distinct trizum accounts separate in
RevenueCat and retain the configured **Keep with original App User ID** restore
behavior. Do not manually alias distinct accounts or enable legacy sharing.
This code does not enumerate or delete arbitrary IDs supplied by the client.

The original-account restore policy protects ownership while RevenueCat retains
the association; deletion removes purchase history. Do not promise that Premium
can always be recovered, or that it can never be restored onto a new account
after erasure. The deletion dialog warns of possible access loss and recreation
on restore. No store restore-policy configuration is changed by this PR.

## Deployment and validation

Before releasing the Worker, grant its existing RevenueCat **v2 secret key**
`customer_information:customers:read_write`, in addition to the existing purchase
and subscription read permissions. Confirm `REVENUECAT_PROJECT_ID` matches the
project used by the native apps. Configure preview/local keys against disposable
test projects only. No database migration or new environment binding is needed.
Without the permission/key/project, deletion fails closed for every account;
it must not silently skip RevenueCat. Never put the secret in client variables.

Ship the Worker and the matching PWA/native copy changes before claiming this
behavior in store disclosures. The fix is prospective: accounts deleted before
this release are not backfilled, because their identity may already be lost.
No live customer deletion or store-console change was performed to validate it.
Unit tests mock RevenueCat; integration tests run the real Better Auth handler
against SQLite with the repository's D1 migrations and mocked external fetch.
The existing `auth_account_deleted` analytics event still means the cloud
request succeeded, not that RevenueCat finished asynchronous erasure. No new
analytics event or account identifier is sent.

## Official references

Reviewed 2026-10-26:

- [Customer API v2](https://www.revenuecat.com/docs/api-v2/customer): deletion
  acknowledgement and required customer read/write permission.
- [API v2 errors and limits](https://www.revenuecat.com/docs/api-v2): error
  resource identifiers, rate limits, and retry guidance.
- [Customer profile deletion](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile#delete-customer):
  customer/purchase history deletion and store subscription behavior.
- [Customer identity](https://www.revenuecat.com/docs/customers/identifying-customers):
  aliases, automatic customer creation, and login/logout behavior.
- [Restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior):
  ownership rules for receipts already associated with another identity.
