# RevenueCat API

`@trizum/revenuecat-api` is trizum's server-side client for the RevenueCat
Developer API v2. It uses RevenueCat's official customer-resources OpenAPI
schema to type requests and responses while exposing a small entitlement-check
interface to the rest of the monorepo.

## Key files

- `src/index.ts` owns authentication, pagination, response validation, and
  direct-entitlement access rules.
- `src/generated/customerResources.gen.ts` is an ignored build artifact
  generated from RevenueCat's official OpenAPI schema.

## Tasks

- `vp run generate`: regenerate the OpenAPI types. This runs automatically
  before this package's check, test, and build tasks.
- `vp run check`: format, lint, and type-check the package.
- `vp run test`: run the package unit tests.
- `vp run build`: build the package into `dist`.
