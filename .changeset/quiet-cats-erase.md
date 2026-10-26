---
"@trizum/pwa": patch
"@trizum/revenuecat-api": patch
---

Request RevenueCat customer deletion before deleting a trizum cloud account through the existing account-deletion flow. If cleanup cannot be confirmed, preserve the account so deletion can be retried safely. Confirm ambiguous missing-customer responses against RevenueCat before completing a retry.

The Worker RevenueCat v2 secret key now requires `customer_information:customers:read_write` in addition to its existing read permissions. Grant this permission before deploying; account deletion fails closed without it.
