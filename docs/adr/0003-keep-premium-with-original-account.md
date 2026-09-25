# Keep Premium with the original trizum account

trizum requires sign-in before a Premium purchase and uses that stable account
ID as RevenueCat's App User ID. RevenueCat is configured to keep a purchase
with its original App User ID in both production and sandbox. Restoring store
purchases therefore restores Premium only when the person is signed in to the
same trizum account; it never transfers Premium to another account.

This preserves a single, auditable Premium owner for Ad-Free access and Party
Boost, including across devices and store restores. It also means deleting the
original trizum account does not cancel its store subscription and may make the
purchase inaccessible in trizum. The deletion flow must disclose that outcome
and direct people to manage an active subscription before deleting their
account.
