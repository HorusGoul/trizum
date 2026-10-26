# RevenueCat API

`@trizum/revenuecat-api` is trizum's server-side client for the RevenueCat
Developer API v2. It uses RevenueCat's official customer-resources OpenAPI
schema and `@hey-api/openapi-ts` to generate a typed Fetch client while
exposing a small entitlement-check and customer-deletion interface to the rest of the monorepo.

## Key files

- `src/index.ts` owns authentication, pagination, response validation, and
  direct-entitlement access rules.
- `openapi-ts.config.ts` pins the RevenueCat schema input and Node-compatible
  generated module specifiers.
- `src/generated/` contains ignored SDK build artifacts generated from
  RevenueCat's official OpenAPI schema.

## Tasks

- `vp run generate`: regenerate the OpenAPI types. This runs automatically
  before this package's check, test, and build tasks.
- `vp run check`: format, lint, and type-check the package.
- `vp run test`: run the package unit tests.
- `vp run build`: build the package into `dist`.

## Customer deletion

`requestCustomerDeletion` uses the v2 customer DELETE endpoint (outside the
generated customer-resources schema). It validates the asynchronous acceptance
response and accepts a customer-specific missing-resource error as already
deleted. For errors without a resource parameter, it confirms customer absence
with a GET and verifies project access through the customer-list endpoint.
The full operation shares a 10-second timeout and has no automatic retries. Callers
must retain the customer identity on failure and authorize deletion themselves.
The secret key needs `customer_information:customers:read_write`. This does not
cancel Apple or Google subscriptions. See the PWA
[account deletion guide](../pwa/docs/account-deletion.md) for lifecycle limits.
