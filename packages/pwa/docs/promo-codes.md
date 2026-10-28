# Premium promo codes

[Back to package overview](../README.md). Read when changing redemption links or store redemption flows.

## Premium Promo Codes

The Premium paywall includes a **Redeem code** action, available even when
products fail to load. Signed-in native redemption identifies the trizum account before opening the store.
Signed-out visitors can open store links directly; optional sign-in and Premium
settings actions remain in the FAQs. Browser Premium help explains how to buy or
restore in the installed mobile app; native Premium help opens the paywall.
Shared codes remain opaque strings, including numeric-looking values; router
search parsing and serialization preserve their exact text.
Apple opens the native sheet without a code, or the App Store offer-code URL
when a code is supplied. Google Play's external redemption supports one-time
codes; checkout help explains how to redeem offers that need the payment-method
menu in Google Play, without asking customers to identify their code type. Custom Google codes do not
provide lifetime access and cannot be redeemed through the external URL.

Share a branded link such as `https://trizum.app/redeem?code=FRIENDS`.
The native platform takes priority; browsers detect iOS/iPadOS or Android and
show the corresponding store. Other devices see both options. Codes remain
store-specific; the same text only works on both stores if separately configured
there. The landing page does not redeem automatically. Native universal/app links already cover
this route, including cold launches. Browser users can follow the documented
store links; Google custom codes require opening trizum on Android and selecting
the subscription plan. Apple/Google's own redemption URLs continue to open their
stores directly, not a trizum route.

`public/_headers` sets `X-Robots-Tag: noindex, nofollow` on `/redeem` and its
subpaths, including query variants; the rendered page also emits a robots meta
tag. Do not add a robots.txt disallow for this path: crawlers must be able to
read the noindex response. Codes are not included in sitemaps.

Opening native redemption records only the trizum account and a 15-minute retry
window locally, never the code. Existing foreground/startup refreshes sync store
purchases and invalidate the RevenueCat cache while that redemption is pending.
Delayed receipts retry until Premium appears or the window expires. Offline
failures preserve cached access, and another signed-in account cannot consume
the pending sync. External redemptions started outside trizum rely on the SDK's
normal transaction discovery; **Restore purchases** remains the explicit
recovery path. Code submission alone never grants Premium or Party Boost.

Create codes, eligibility, usage limits and expiry in App Store Connect or Play
Console. This UI does not create offers or validate redemption counts itself.
