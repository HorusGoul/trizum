# @trizum/revenuecat-api

## 1.0.1

### Patch Changes

- [#490](https://github.com/HorusGoul/trizum/pull/490) [`5acfdbc`](https://github.com/HorusGoul/trizum/commit/5acfdbce9a6f64a0d107ffa7d858378e3470c84e) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Request RevenueCat customer deletion before deleting a trizum cloud account through the existing account-deletion flow. If cleanup cannot be confirmed, preserve the account so deletion can be retried safely. Confirm ambiguous missing-customer responses against RevenueCat before completing a retry.

  The Worker RevenueCat v2 secret key now requires `customer_information:customers:read_write` in addition to its existing read permissions. Grant this permission before deploying; account deletion fails closed without it.
