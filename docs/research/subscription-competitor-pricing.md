# Subscription competitor and pricing research

**Snapshot date:** 2026-07-19
**Scope:** Consumer bill-splitting competitors, adjacent substitutes, pricing architecture, paywall placement, and implications for trizum.
**Source standard:** Official product/help/legal pages and Apple/Google storefronts only.

## Executive recommendation

Launch one person-owned **trizum Premium** entitlement with:

- **€2.99/month**, no trial;
- **€19.99/year**, selected by default, with a **7-day free trial**;
- **€59.99 lifetime**, for people who reject subscriptions;
- localized Apple/Google price tiers instead of literal currency conversion;
- one included Party Boost that the owner may explicitly assign to one party
  and move once every seven days.

Keep the shared ledger free: unlimited parties and expenses, offline use, live party collaboration, flexible splits, balances, optimized settlements, and Tricount import. The initial Premium capability is an ad-free Mobile App for the owner. Party Boost establishes the organizer-funded, party-scoped authorization structure without promising a specific set of shared capabilities yet.

This puts trizum near the value-subscription benchmark established by Settle Up (€21.99/year in Spain), well below Splitwise's higher observed annual catalog prices, and above the very cheap apps whose paid value is mostly ad removal or support. The annual offer is a **44% discount** versus twelve monthly payments (€35.88), large enough to make annual feel deliberate without presenting a deceptive monthly equivalent.

The annual trial should be seven days because it is long enough to create a real party, collaborate, and see a useful balance, while matching Splitwise's current public trial. Do not place the trial on monthly: it weakens the distinction between “try Premium” and a low-commitment paid month. Measure trial-to-paid conversion and realized revenue, not trial starts alone.

The included Party Boost replaces the separately purchased Party Pass hypothesis. Splitwise's Trip Pass and party-level purchasing in Settle Up, Sesterce, and Kittysplit still validate organizer-funded value, but trizum will first test it as a benefit of each person-owned Premium product.

## Important pricing caveat

Prices below are storefront snapshots, not a promise that every listed SKU is on the live in-app paywall. Apple product pages can show up to ten sold in-app products, including products created for earlier prices or experiments; RevenueCat explicitly warns that customers may see catalog prices different from the offer served inside the app. Several competitors have duplicate same-name products or multiple lifetime prices. See RevenueCat's [experiment-product guidance](https://www.revenuecat.com/docs/tools/experiments-v1/creating-offerings-to-test).

Therefore:

- use named durations only when an official source maps the duration;
- label unexplained storefront SKUs as catalog observations;
- verify any final benchmark on a real device in the target storefront before changing trizum's price;
- never hardcode a localized display price in trizum.

## Competitor matrix: observed facts

| Product                      | Current model and observed price                                                                                                                                                                                                                                                                                          | Paid value / paywall                                                                                                                                                                                                                                                                                             | Trial, ads, and uncertainty                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Splitwise**                | Individual auto-renewing Pro. The Spain App Store currently exposes repeated €2.99 and €29.99 products plus €35.99 and €47.99 catalog entries; the US page exposes products including $4.99 and $39.99. Splitwise confirms monthly and annual renewal, local variation, and a 30-day Trip Pass benefit.                   | Pro: unlimited daily expense entry, receipt OCR/itemization, receipt storage, currency conversion, US-only transaction import, charts, search, default/custom split ratios, early access, and no ads. Its core paywall is unusually aggressive because free accounts have a daily expense limit.                 | Current offer: 7-day free trial. Exact live price and free expense-cap count are not public without entering the product flow. Sources: [Pro features](https://www.splitwise.com/subscriptions/new), [current offer, trial, and Trip Pass](https://www.splitwise.com/offer), [expense-limit help](https://feedback.splitwise.com/knowledgebase/articles/2010350-why-am-i-seeing-an-expense-limit), [terms](https://www.splitwise.com/terms), [Spain App Store](https://apps.apple.com/es/app/splitwise/id458023433), [US App Store](https://apps.apple.com/us/app/splitwise/id458023433).                                                                   |
| **Settle Up**                | Individual Premium plus Party Premium passes. Spain: €3.99/month or €21.99/year; party products include €5.99/week, €9.99/two weeks, €14.99/month, €44.99/year, and €179.99 lifetime. US: $3.99/month or $19.99/year; party options include $5.99/week, $9.99/two weeks, $14.99/month, $39.99/year, and $149.99 lifetime. | Premium removes ads and adds receipt photos/PDFs, recurring and future expenses, custom categories, Excel export, and statistics. Party Premium gives the benefits to everyone in one party.                                                                                                                     | Free contains ads. Release history mentions an Individual Premium trial but no current public duration. Duplicate/inconsistently named party SKUs make the live menu uncertain. Older official tips describe a movable one-time Party Premium; timed passes were added later. Sources: [Spain App Store](https://apps.apple.com/es/app/settle-up-group-expenses/id737534985), [US App Store](https://apps.apple.com/us/app/settle-up-group-expenses/id737534985), [Party Premium tip](https://settleup.io/tips), [Google Play](https://play.google.com/store/apps/details?id=cz.destil.settleup).                                                           |
| **Splid**                    | Very cheap IAP model. Spain: Splid Plus €3.99 and “2 groups” €2.99; US: $3.99 and $2.99.                                                                                                                                                                                                                                  | Core includes online/offline parties, no required signup, 150+ currencies and conversion, unequal splits, PDF summaries, and settlement minimization. Excel export is explicitly paid. Product naming suggests that party capacity is another value metric.                                                      | No trial or advertising label is shown. Public pages do not define Plus precisely or state the purchase type, so do not call it lifetime solely from the catalog. Sources: [Spain App Store](https://apps.apple.com/es/app/splid-compartir-gastos/id991473495), [US App Store](https://apps.apple.com/us/app/splid-split-group-bills/id991473495), [Google Play](https://play.google.com/store/apps/details?id=splid.teamturtle.com.splid).                                                                                                                                                                                                                 |
| **tricount by bunq**         | Free and unlimited; no subscription, hidden fee, party limit, or expense limit is advertised, and Apple lists no IAP.                                                                                                                                                                                                     | Free includes unequal splitting, receipt photos, offline tracking, multiple currencies, live collaboration, payment requests, and recent spending statistics. Premium was deprecated; some old Premium capabilities, including direct CSV/PDF export and personal mode, were removed.                            | No trial. The product prominently cross-sells a free bunq-powered card, payment import, and eSIM. Treat “tricount as bunq acquisition/engagement” as an inference from product positioning, not a disclosed revenue breakdown. Sources: [official site](https://tricount.com/en-us/), [Premium deprecation](https://help.tricount.com/articles/what-happened-with-tricount-premium), [Spain App Store](https://apps.apple.com/es/app/tricount-gastos-compartidos/id349866256), [US App Store](https://apps.apple.com/us/app/tricount-share-expenses/id349866256), [Google Play](https://play.google.com/store/apps/details?id=com.tribab.tricount.android). |
| **Sesterce**                 | Hybrid party and user pricing. Spain shows 30 days of Premium €1.99, Premium for Life €5.99, “all groups premium” €1.99, and all groups of a user €49.99; US shows $1.99, $4.99, $1.99, and $49.99 respectively.                                                                                                          | Premium adds images, recurring operations, push notifications, advanced search, full change history, and PDF export. Party Premium benefits every member of one party; User Premium covers all of one user's parties across devices. Core custom categories, statistics, and CSV export remain free.             | Terms allow a location-dependent trial but no current duration is promised. Public SKU labels do not map every product cleanly to monthly versus one-time. Sources: [Premium documentation](https://sesterce.io/docs/premium/), [terms](https://sesterce.io/terms_and_conditions.html), [Spain App Store](https://apps.apple.com/es/app/sesterce-compartir-gastos/id1239566667), [US App Store](https://apps.apple.com/us/app/sesterce-split-expenses/id1239566667).                                                                                                                                                                                        |
| **Splitser / WieBetaaltWat** | Spain catalog: Premium €1.99 and €9.99 plus a separate €2.99 ad-free product. US: Premium $1.99 and $8.99 plus $2.99 ad-free. Voluntary support IAPs are also sold.                                                                                                                                                       | The app advertises multi-currency expenses, images, recurring expenses, reminders, search, export, insights, direct iDEAL/Bancontact settlement, and offline mode. January 2026 release notes say Premium introduced CSV/PDF export and an ad-free experience.                                                   | Free contains ads; no public trial was found. Public pages do not map €1.99/€9.99 to durations, and the separate ad-free product makes the current bundle unclear. Sources: [Spain App Store](https://apps.apple.com/es/app/splitser/id1154059529), [US App Store](https://apps.apple.com/us/app/splitser-wiebetaaltwat/id1154059529), [official site](https://splitser.com/).                                                                                                                                                                                                                                                                              |
| **Splittr**                  | Spain: €0.99/month, €3.99/year, and lifetime catalog entries of €6.99 and €11.99. US: $0.99/month, $3.49/year, and lifetime entries of $5.99 and $10.99.                                                                                                                                                                  | Most core and power features are advertised in the base listing: offline sync, all currencies, custom categories, PDF/CSV export, statistics, uneven splits, and backups. Current release notes made currency conversion free and reduced advertising, so paid value appears weighted toward ad removal/support. | Contains ads; no trial stated. Multiple lifetime entries are likely old/current price points and the exact paid entitlement is not publicly defined. Sources: [Spain App Store](https://apps.apple.com/es/app/splittr-expense-splitting/id588332804), [US App Store](https://apps.apple.com/us/app/splittr-expense-splitting/id588332804).                                                                                                                                                                                                                                                                                                                  |
| **Kittysplit**               | Free through nine participants, then approximately €3 once per Kitty/party. One payer upgrades everyone in that party. Donations are another disclosed funding source.                                                                                                                                                    | Free includes unlimited expenses, settlements, link sharing, browser/mobile use, and CSV export. Super Kitty adds 10+ people, multiple currencies, and receipt uploads.                                                                                                                                          | Current comparison pages say no ads; an older privacy policy still contains stale ad language. No trial is needed for the one-time purchase. Sources: [current pricing/comparison](https://www.kittysplit.com/en/splitwise-alternative), [Super Kitty launch](https://blog.kittysplit.com/kittysplit-premium-features/), [ad shutdown](https://blog.kittysplit.com/adsense-is-broken/).                                                                                                                                                                                                                                                                     |

### Adjacent substitutes

- **Venmo Groups** is a US-only free ledger embedded in a payment network. It supports up to 30 members, custom shares, minimized settlement, and direct Venmo repayment. Venmo monetizes payment rails where applicable: credit-card-funded personal payments cost 3% and instant bank transfer costs 1.75%. Sources: [Groups setup](https://help.venmo.com/cs/articles/setting-up-a-group-vhel106), [expense management](https://help.venmo.com/cs/articles/managing-expenses-for-venmo-groups-vhel173), [fees](https://venmo.com/legal/fees), [US eligibility](https://venmo.com/legal/us-user-agreement).
- **Tab** gives away the restaurant moment—receipt OCR, real-time item claiming, and proportional tax/tip—without an IAP in its US listing. This narrows the willingness to pay for receipt itemization alone. Source: [US App Store](https://apps.apple.com/us/app/tab-the-simple-bill-splitter/id595068606).

## Market strategy patterns: observations

### 1. There is no accepted subscription norm

The market sustains several architectures:

- individual recurring subscriptions: Splitwise and Settle Up;
- cheap IAP or lifetime access: Splid and Splittr;
- per-party passes or unlocks: Settle Up, Sesterce, and Kittysplit;
- free products subsidized by a broader financial network: tricount/bunq and Venmo;
- ads plus optional removal/support: Splitser and Splittr.

trizum should not infer that a subscription is automatically accepted just because Splitwise sells one. A subscription must represent ongoing value or cost.

### 2. Splitwise is the aggressive outlier

Splitwise monetizes unlimited expense entry—the core repeated action. Most substantiated alternatives keep expense entry and settlement free, then charge for convenience, storage, automation, export, analytics, customization, ads, or scale. “Unlimited expenses” has become explicit counter-positioning for tricount and Kittysplit.

**Implication:** do not cap trizum's daily expense entry. A cap is especially damaging in collaborative software because one non-paying member can block or fragment a party's shared record.

### 3. Party pricing fits episodic travel

A trip is temporary and has many beneficiaries. Settle Up sells access from one week through lifetime, Sesterce sells Party Premium, Kittysplit charges once per Kitty, and Splitwise advertises a 30-day Trip Pass shared with a party.

**Implication:** Party Boost is a credible organizer-funded value metric, while
Lifetime Premium addresses the separate audience that will not subscribe.
Keeping the boost attached to a person-owned Premium purchase avoids adding a
fourth store product before its concrete party capabilities are understood.

### 4. Paid features cluster around convenience and cost-to-serve

Repeated paid categories are:

- receipt storage, OCR, and itemization;
- recurring/future expenses and transaction import;
- advanced search, history, statistics, and exports;
- customization and default templates/splits;
- multi-device cloud access;
- ad removal.

The products charging roughly €20–€40 per year bundle several of these. Very cheap products mostly remove ads, sell a small capacity unlock, or ask for support.

### 5. The credible annual bands are broad

- **Higher individual subscription:** Splitwise's public catalogs include roughly €30/year in Spain and $40/year in the US, alongside other legacy/test entries.
- **Value individual subscription:** Settle Up is €21.99/year in Spain and $19.99/year in the US.
- **Micro-subscription/support:** Splittr is €3.99/year in Spain and $3.49/year in the US.

trizum at €19.99/year belongs in the value band. Charging near Splitwise before trizum has OCR, transaction import, advanced search, and mature reporting would be difficult to justify.

## trizum's current product position: repository observations

trizum already has a strong free core:

- its store description promises offline-first behavior, real-time party sync, flexible splits, receipt attachments, multiple parties, optimized settlement, and optional cloud access ([mobile store description](../../packages/mobile/ios/App/fastlane/metadata/en-US/description.txt));
- the persisted/shared model is Automerge and ordinary UI state stays local ([PWA README](../../packages/pwa/README.md));
- settlement and flexible exact/divide shares are implemented in the expense model ([expense model](../../packages/pwa/src/models/expense.ts));
- party statistics support all time, current month, current year, past years, and a custom date range ([stats view](../../packages/pwa/src/components/PartyStatsView.tsx));
- each party supports at most four expense templates ([template model](../../packages/pwa/src/models/expenseTemplate.ts));
- receipt attachments are part of the expense model and editor ([expense model](../../packages/pwa/src/models/expense.ts), [expense editor](../../packages/pwa/src/components/ExpenseEditor.tsx));
- Tricount import is an existing acquisition path ([migration route](../../packages/pwa/src/routes/migrate_.tricount/route.tsx));
- optional cloud sync provides signed-in access across devices ([cloud-sync route](../../packages/pwa/src/routes/_home/settings_.cloud-sync.tsx)).

These promises constrain responsible paywall placement. In particular, the current store description says trizum is free and presents receipts/cloud access as current capabilities. Update store copy when subscriptions ship, preserve existing data access, and avoid silently taking away a capability from an installed version.

## Recommended trizum packaging

### Free: protect the network and trust loop

Keep these free and unlimited:

- create and join parties;
- add, edit, and delete expenses;
- offline-first storage and live party collaboration;
- equal, exact, percentage/share-style splits and multiple payers;
- balances and optimized settlement suggestions;
- core receipt viewing and access to every existing attachment;
- Tricount import;
- a useful basic statistics summary;
- one expense template per party.

The rule is simple: a free participant must be able to join, understand, correct, and settle a party without paying. Otherwise Premium harms collaboration and acquisition.

### Premium: ongoing personal convenience

Bundle the following under one `pro` entitlement:

- cloud sync/backup across the subscriber's own devices;
- ongoing or higher-limit receipt attachment storage, while all existing receipts remain readable after downgrade;
- complete party statistics: past-year selection, custom date ranges, rankings, and deeper comparisons;
- all four expense templates per party;
- future premium additions such as recurring expenses, richer export, search/history, or OCR when they exist;
- an explicit “support independent development” benefit, but never as the only value.

This package uses capabilities trizum actually has while leaving room to deepen Premium. Cloud access and media are defensible subscription features because they create ongoing service/storage cost. Stats and templates supply immediate in-app value without compromising ledger integrity.

### Downgrade behavior

- Never hide or delete expenses, balances, parties, or existing receipt media.
- Keep previously created templates usable for adding expenses, but require Premium to create or edit beyond the free allowance.
- Keep previously synchronized local data available offline.
- Show a clear explanation before stopping new premium-only writes.

Sesterce follows the useful precedent that uploaded pictures remain readable and existing recurring operations remain active after cancellation, while new premium writes stop ([Sesterce Premium cancellation behavior](https://sesterce.io/docs/premium/)).

## Paywall placement recommendation

Use contextual paywalls after intent, not a cold-start wall:

1. when a user enables cloud sync across their devices;
2. when they add a second expense template;
3. when they select a premium statistics timeframe or comparison;
4. when they exceed the free allowance for new cloud-backed receipt storage;
5. from a persistent “Premium” row in Settings;
6. as a soft, dismissible value reminder after the first successful settlement—not before the party has worked.

Do not show a blocking paywall when a participant joins a party, adds an ordinary expense, opens a receipt shared by someone else, checks a balance, or settles. Those are collaboration-critical paths.

## RevenueCat implementation and experiments

### Initial catalog

- Create one entitlement: `premium`.
- Create one current `default` offering with RevenueCat's standard monthly,
  annual, and lifetime packages mapped to equivalent Apple and Google products.
- Fetch `offerings.current`; do not hardcode offering identifiers or prices in the UI. RevenueCat says the current offering can be changed remotely and that packages group equivalent products across platforms ([Offerings documentation](https://www.revenuecat.com/docs/offerings/overview)).
- Display the localized store price and billing period returned by the SDK.
- Put the seven-day introductory trial on the annual store products only. Apple applies eligible introductory offers automatically; Google selection depends on base-plan/offer configuration, and RevenueCat documents its automatic selection rules ([trial and offer guidance](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers)).
- Verify restore, expiration, billing retry, cancellation, account switching, anonymous-to-signed-in identity, and offline entitlement-cache behavior before release.

### Launch measurement

Track at least:

- paywall view by placement;
- package selection and purchase start;
- purchase, restore, cancellation, billing issue, and expiration;
- annual trial start, trial conversion, refund, and 30/90-day realized revenue;
- Premium feature activation after purchase;
- party creation, first expense, first collaborator, and first settlement as non-revenue guardrails.

The guardrails matter: an experiment that raises short-term conversion while reducing completed collaborative parties is not a win.

### Experiment order

Do not launch multiple price menus at once. Start with the firm baseline, then test one hypothesis at a time after there is enough traffic:

1. **Price test:** €19.99/year + €2.99/month versus €24.99/year + €3.99/month. Hold copy, trial, and layout constant.
2. **Trial test:** seven-day annual trial versus no trial. Hold prices constant.
3. **Packaging/copy test:** “cloud, receipts, stats, templates” versus benefit-led copy about peace of mind and faster repeat expenses. Hold products constant.
4. **Party Boost messaging:** compare organizer-led positioning only after
   concrete party capabilities are defined. Hold products and prices constant.

RevenueCat Experiments can test price, trial presence/length, product mix, and paywall design through separate Offerings, and supports placement-specific tests ([Experiments](https://www.revenuecat.com/docs/tools/experiments-v1), [configuration and placements](https://www.revenuecat.com/docs/tools/experiments-v1/configuring-experiments-v1)). Experiments are a Pro/Enterprise RevenueCat feature; if trizum is not on that plan, use stable release cohorts and store products carefully rather than inventing client-side randomization.

For each new price test, remember that Apple requires new IAP approval and may expose the test products on the public App Store product page. RevenueCat recommends distinct App Store subscription groups for experiment offerings to reduce accidental cross-offer subscription visibility, but this must be balanced against catalog clutter and migration complexity ([creating offerings to test](https://www.revenuecat.com/docs/tools/experiments-v1/creating-offerings-to-test)).

### Confirmed Party Boost boundaries

- Premium remains owned by the signed-in payer.
- The owner explicitly assigns one boost to one party; purchase never silently
  assigns it.
- A party accepts at most one active boost, and the owner must remain a member.
- The owner may move the boost once every seven days.
- Boost state is server-authoritative and stale-while-revalidate for offline
  clients.
- A boost does not make other members Premium or promise them a completely
  ad-free experience.

RevenueCat records the person's Premium purchase; trizum owns the durable
party-level authorization model.

## Final decision

Start with **€2.99 monthly / €19.99 annual / €59.99 lifetime**, annual
preselected, and a **seven-day trial on annual only**. Keep the collaborative
ledger free. Launch with the owner's ad-free benefit and the Party Boost
authorization structure; define additional person- and party-scoped
capabilities in a follow-up.

This is conservative about the network and firm about revenue: it prices trizum as a serious maintained service without copying Splitwise's most hostile paywall or competing with subsidized-free products on their terms.
