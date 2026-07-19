# trizum

trizum helps groups record, split, and settle shared expenses across web and
mobile distributions.

## Distribution

**Mobile App**:
The installed iOS or Android distribution of trizum. It is the only
distribution currently eligible to show advertising.
_Avoid_: Native app

**Production Artifact**:
An official Mobile App binary distributed through the App Store, Google Play,
or as the signed APK attached to a production GitHub Release. Only Production
Artifacts are eligible to request live advertising.
_Avoid_: Release build

**Live Ad Configuration**:
The explicit production-workflow selection of committed real AdMob app and ad
unit identifiers. A workflow selecting live advertising must fail its build if
any identifier for that platform is missing; workflows without that selection
always use Google's test identifiers and never infer or silently fall back to
live advertising.
_Avoid_: Production-mode ads

**Live Ad Release Gate**:
The conditions that must be satisfied before any Production Artifact selects
the Live Ad Configuration. The Premium Ad-Free Entitlement must have landed,
the privacy policy and store disclosures must match the final SDK and UMP
configuration, and a focused legal review must approve the GDPR legal bases,
international-transfer wording, and applicable US sale/share disclosures. The
implementation may merge and continue using test ads before this gate is met.
_Avoid_: Merge blocker

**Seller Declaration**:
The public Google-only app-ads.txt record served from
`https://trizum.app/app-ads.txt`. It identifies trizum's AdMob publisher and is
already part of the Web App deployment.
_Avoid_: Ads configuration file

**Web App**:
The browser-accessed distribution of trizum, including when installed as a
Progressive Web App. It does not show advertising.
_Avoid_: Website

## Monetization

**Intended Audience**:
Adults aged 18 and over. trizum is not designed or directed toward children or
people under 18.
_Avoid_: General audience

**Ad Content Standard**:
Advertising shown in trizum is limited to content rated Parental Guidance or
lower, even though the Intended Audience is adults.
_Avoid_: Mature ads

**Ad Demand**:
Advertising supplied directly through Google AdMob without third-party
mediation networks.
_Avoid_: Mediated ads

**Advertising Data Boundary**:
The separation that prevents expense, group, participant, and account data
from being provided to advertising systems. Advertising may use platform
signals governed by Ad Consent and Tracking Permission, including AdMob's
Publisher First-Party ID. trizum does not enrich those signals with account,
domain, or analytics data and disables optional third-party identifier sharing.
_Avoid_: Expense targeting

**Publisher First-Party ID**:
An AdMob-generated pseudonymous identifier for recognizing a person within a
publisher's apps when third-party device identifiers are unavailable. trizum
permits it for consent-governed ad delivery and personalization, without
Firebase enrichment, user-insight surveys, custom identifiers, domain data, or
optional third-party identifier sharing.
_Avoid_: trizum user ID

**Ad Diagnostic**:
A sanitized advertising SDK failure reported through trizum's existing error
monitoring with only coarse platform, format, lifecycle stage, and SDK error
code context. It excludes domain data, account data, consent choices,
advertising identifiers, and ad-response details; successful impressions and
clicks remain solely in AdMob reporting.
_Avoid_: Ad analytics

**Ad Opportunity**:
A product moment when the Mobile App may present a full-screen advertisement
if the user is eligible and an advertisement is ready. It never delays or
blocks the product action that created the opportunity. A failed presentation
ends that opportunity; trizum does not retry or present a replacement later.
_Avoid_: Ad trigger

**Prepared Ad**:
A full-screen advertisement loaded for a possible future Ad Opportunity.
trizum keeps at most one per format, and loading one never creates an
opportunity by itself. A presented or failed ad may be replaced only for a
future opportunity; an App Open Ad is discarded after four hours.
_Avoid_: Queued ad

**App Open Opportunity**:
An Ad Opportunity created by a cold launch or by returning after at least 30
minutes of inactivity. On a cold launch, an eligible ad load may begin during
natural startup, but the opportunity expires as soon as the first interactive
screen is ready and never extends the splash. On a qualifying warm return, only
an already-Prepared Ad may be presented. Brief interruptions do not create App
Open Opportunities. If an Ad Consent or Tracking Permission interface is
actually presented during the launch, its App Open Opportunity expires;
Interstitial Opportunities later in the session remain eligible.
_Avoid_: Every foreground

**Protected Flow**:
An in-progress or sensitive interaction, such as editing, payment,
authentication, media selection, recovery, or subscription purchase, over
which an App Open Ad may not appear. An opportunity encountered during a
Protected Flow is skipped rather than deferred.
_Avoid_: Deferred app-open ad

**Ad Consent**:
A person's current privacy choice governing whether advertising may be
requested and how it may be personalized. It is distinct from Apple's
permission to track across apps and websites. trizum relies on the consent
platform's jurisdiction-aware result: it presents required consent or opt-out
messages in covered regions and does not add a separate consent prompt where
the platform reports none is required.
_Avoid_: Tracking permission

**Privacy Options**:
The Settings entry that reopens the consent platform when it reports that a
privacy control is required. Its user-facing label is “Privacy and cookie
settings” in English and “Privacidad y configuración de cookies” in Spanish.
_Avoid_: Ad preferences

**Consent Refresh Failure**:
An eligible launch where the consent platform cannot refresh the person's
advertising choices. trizum remains fully usable but suppresses advertising
for that app session, records only a sanitized diagnostic, and tries again on
the next eligible launch rather than interpreting or falling back to cached
consent state itself.
_Avoid_: Cached consent fallback

**Tracking Permission**:
The optional iOS authorization to use an advertising identifier for tracking
across apps and websites. It is requested only after the First-Use Session, and
denial does not prevent advertising or access to trizum.
_Avoid_: Ad consent

**Ad-Free Entitlement**:
A Premium benefit that makes its holder ineligible for advertising throughout
the Mobile App.
_Avoid_: Premium user

**Ad Eligibility**:
The current determination that a person may be shown advertising. Eligibility
requires an explicit absence of the Ad-Free Entitlement; an unknown, loading,
or failed entitlement state is ineligible.
_Avoid_: Not premium

**First-Use Session**:
The period beginning when the advertising subsystem first observes a Mobile App
installation and ending after the app has remained inactive for 30 minutes. An
existing installation upgrading to the first ad-enabled release has no local Ad
History and therefore receives the same ad-free session as a new installation.
Advertising initialization, Ad Consent prompts, Tracking Permission prompts,
and advertisements are all ineligible throughout this period.
_Avoid_: First launch

**Full-Screen Ad Cooldown**:
The 30-minute interval beginning when an App Open Ad or Interstitial Ad
actually becomes visible, during which no other full-screen advertising is
eligible to appear. Loading and presentation failures do not begin the
cooldown, while dismissal after any visible presentation does. The cooldown is
shared across both formats and does not impose a per-session limit.
_Avoid_: Per-format cooldown

**Ad History**:
The installation-local record of First-Use Session completion and the most
recent full-screen advertisement. It does not synchronize between devices or
with shared expense data.
_Avoid_: Synced ad state
