# RevenueCat API

`@trizum/revenuecat-api` is trizum's server-side client for the RevenueCat
Developer API v2. It uses RevenueCat's official customer-resources OpenAPI
schema to type requests and responses while exposing a small entitlement-check
interface to the rest of the monorepo.

## Key files

- `src/index.ts` owns authentication, pagination, response validation, and
  direct-entitlement access rules.
- `src/generated/customerResources.gen.ts` is generated from RevenueCat's
  official OpenAPI schema and committed to the repository.

## Tasks

- `vp run generate`: regenerate the OpenAPI types.
- `vp run check`: format, lint, and type-check the package.
- `vp run test`: run the package unit tests.
- `vp run build`: build the package into `dist`.
