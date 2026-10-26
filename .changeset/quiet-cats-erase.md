---
"@trizum/pwa": patch
"@trizum/revenuecat-api": patch
---

Request RevenueCat customer deletion before deleting a trizum cloud account. If cleanup cannot be confirmed, preserve the account so deletion can be retried safely. Clarify that shared group data remains, store subscriptions must be managed separately, and restoring purchases may recreate purchase data.

The Worker RevenueCat v2 secret key now requires `customer_information:customers:read_write` in addition to its existing read permissions. Grant this permission before deploying; account deletion fails closed without it.
