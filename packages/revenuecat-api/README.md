# RevenueCat API

`@trizum/revenuecat-api` is trizum's server-side client for the RevenueCat
Developer API v2. It uses RevenueCat's official customer-resources OpenAPI
schema and `@hey-api/openapi-ts` to generate a typed Fetch client while
exposing a small entitlement-check interface to the rest of the monorepo.

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
