# App Store creative assets: release integration and API research

Researched **2026-11-09**. Read when changing product page header uploads or
updating organic search artwork. Header/search image/video upload and placement are now
implemented locally; the remaining sections record the API research. No
authenticated uploads, submissions, or publishing were performed during this work.

## Approved header and next-release behavior

The reviewed, dark-only animation lives in
[`creative_assets`](../ios/App/fastlane/creative_assets/README.txt). Its
[`manifest.json`](../ios/App/fastlane/creative_assets/manifest.json) pins the exact
English and Spanish MP4s by SHA-256. Both are 3840 × 1646, 20 seconds, 60 fps,
silent H.264. The video poster timecode is `00:00:10:48` (10.8 seconds at 60 fps),
showing the combined trip total before the repayments.

Editable animation, preview, and original search concept source now lives in
[`packages/screenshots/src/creative-assets`](../../screenshots/src/creative-assets/).
The [generation guide](../../screenshots/docs/creative-assets.md) covers local
previews, exports, validation, and explicit selection. Generation writes ignored
drafts. Only `creative:prepare` copies reviewed files into this selected manifest.
The generic manifest supports header/search PNGs and MP4s; its current entries
select only the approved header videos.

`deploy_appstore_full` calls `upload_creative_assets` after `deliver` creates or
updates the version and before submitting it for review. The lane uses the
existing API key and the native version number. It validates the approved file
hashes, discovers compatible image/video specs and mobile groups from Apple's
current catalog, and requires the selected localizations on that exact editable
iOS version. It processes every selected asset before changing any placement.

Reference names contain the locale and full content hash, allowing subsequent
releases to reuse the same library assets. Matching placements are retained;
only selected locale/type/group slots are replaced. Asset
reservations and placement creation are not blindly retried. Processing and
network requests have timeouts. A failure aborts the release lane before app
review and records asset IDs, states, and any interrupted replacement in
the temporary directory's `trizum-creative-assets.json` (or the lane's explicit
`report` path). The release workflow retains that report as `ios-creative-assets`,
including when deployment fails. Its timeout allows for first-upload processing
of both videos, with up to ten minutes of polling per video.
The contract tests run through `vp run ruby:check:ios` in the mobile package.

`CreativeAssetsAPIClient` limits both Spaceship's outer API retry loop and its
inner HTTP transport retry loop to one attempt for POST. Other methods retain
the pinned client's behavior and all requests retain its JWT middleware. The
transport tests use that real client with Faraday's test adapter to simulate a
lost response after a successful reservation or placement; no create request
is replayed after a timeout or connection failure.

Merging this integration performs no Apple mutations. The next normal App Store
release uploads, reviews, and publishes these placements with its app version.
No standalone submission or automatic deployment is added to the merge workflow.
Search artwork is supported by the adapter but remains unselected until reviewed. The image/poster PNGs in
the directory are references; Apple generates the video's poster from its
timecode. A live authenticated API test remains deferred to that release.

## Finding and repository baseline

**Fastlane can orchestrate this through custom Spaceship requests; existing
`deliver` screenshot lanes do not support these assets.** Apple exposes an App
Asset Library with reusable images and separate placements. These optional
creative assets appear on iOS 27 and iPadOS 27 or later; they do not replace
screenshots. See Apple's [library overview][library] and [asset management][manage].

The repository pins Fastlane **2.231.1** in
[`Gemfile.lock`](../ios/App/Gemfile.lock). Its
[`Fastfile`](../ios/App/fastlane/Fastfile) loads a base64 App Store Connect key,
uploads metadata and screenshots through `deliver`, and bounds screenshot
synchronization to five minutes. The
[App Store workflow](../../../.github/workflows/ios-appstore-deploy.yml) generates
screenshots and invokes `deploy_appstore_full`; it has no creative-asset input or
upload step of its own; header upload now runs inside `deploy_appstore_full`.
Existing lane documentation is in [Fastlane](./fastlane.md).

Source inspection found no asset-library models, endpoint wrappers, or creative
asset options in pinned 2.231.1, latest released [2.241.2][release] (2026-10-26), or
[upstream master at `708dcc6`][upstream] (2026-11-08). The released
[`deliver` uploader][deliver-source] still targets screenshot sets. This is an
inspection finding, not a claim about third-party plugins or future releases.

## Pending upstream support

Follow-up inspection of GitHub Issues, PRs, and Discussions on **2026-11-09**
found active work that is not yet in a Fastlane release:

- [Discussion #30441](https://github.com/fastlane/fastlane/discussions/30441)
  requests header and organic search creative assets. Its author links the image
  implementation below.
- [PR #30442](https://github.com/fastlane/fastlane/pull/30442) is open and ready
  for review. It adds Spaceship Asset Library image support and opt-in
  `creative_assets` entries with `locale`, `path`, `placement_type`, and
  `placement_group`. Replacing an occupied target requires
  `overwrite_creative_assets: true`. It handles editable app versions, not
  standalone asset review. The author reports a successful live image upload and
  processing test, but has not tested live placement creation or replacement.
- [PR #30457](https://github.com/fastlane/fastlane/pull/30457) is an open draft
  that depends on #30442. It adds MP4/M4V/MOV support and optional
  `preview_frame_time_code`. The author reports passing upstream CI but no live
  video upload or placement test. Standalone review remains out of scope.

No merge or release date is established by these threads. Prefer a local manifest
that can map to the proposed `creative_assets` fields, and keep generation apart
from upload. A temporary custom lane can reuse the same shape until upstream
support ships; using an unmerged fork would require its own integration testing.
The earlier source inspection alone did not reveal this pending implementation.

## Verified image requirements and design guidance

Apple's [creative asset specifications][specs] list:

| Placement           | Aspect ratio | Pixel dimensions                | Extensions              |
| ------------------- | ------------ | ------------------------------- | ----------------------- |
| Product page header | 21:9         | 3840 × 1646                     | `.jpeg`, `.jpg`, `.png` |
| Search results      | 3:2          | 1920 × 1280 through 3840 × 2560 | `.jpeg`, `.jpg`, `.png` |
| Either, universal   | 16:9         | 5244 × 2950                     | `.png`                  |

Images must have **no alpha channel and no transparency**, even if all alpha
values would be opaque. Preserve Apple's exact pixel dimensions rather than
recalculating them from the rounded aspect ratios. For automation, discover the
currently accepted specifications and size limits from [reference data][discover];
verify `universalAsset` and compatible placement types before reusing one image
for both slots. Apple also documents separate video specifications; image
dimensions alone do not validate a video.

For **creative videos**, the same [specifications][specs] require 5–30 seconds,
30 or 60 fps, and `.mov`, `.m4v`, or `.mp4`. Header video is exactly
3840 × 1646; search video is 3:2 at 1920 × 1280 through 3840 × 2560. The
5244 × 2950 universal image option is not listed for video. Videos loop
continuously. Both placements start muted; only product page video can be
unmuted. The [video guidance][design] recommends a compelling poster frame,
leading with the value proposition, giving people time to read, avoiding rapid
cuts, and making the loop seamless and understandable without audio.

Custom illustration and motion can express the app's functionality or brand in
these creative placements. This differs from the screen-recording requirement
for app previews in [Review Guideline 2.3.4][review-guidelines]. Creative assets
remain subject to 2.3.14 and accurate metadata: a receipt illustration can
represent adding an expense, but should not suggest receipt scanning or automatic
payments unless the app actually provides those features.

Apple's [design guidance and downloadable templates][design] require artwork
related to the app's functionality, suitable for a 4+ audience. Exclude specific
prices, discounts, URLs, copyright symbols, other-platform or marketplace logos
and references, unverifiable awards, and Apple-designated recognitions. Use short,
localized text when useful. Headers can emphasize brand or value; search artwork
should make the app's purpose clear and can show its interface.

Plan for cropping across devices and orientations: keep the focal artwork
centered and important details inside the template safe area. Inspecting the
`Art Safe Area` layers in Apple's dedicated Photoshop templates on the research
date gave these bounds (origin at the top left; right and bottom are exclusive):

| Template                                     | Canvas      | Safe-area bounds `(left, top, right, bottom)` |
| -------------------------------------------- | ----------- | --------------------------------------------- |
| [Header Photoshop template][header-template] | 3840 × 1646 | `(1097, 493, 2743, 1154)`                     |
| [Search Photoshop template][search-template] | 3840 × 2560 | `(836, 765, 3004, 1795)`                      |

Scale those coordinates with the artwork when using the smaller 1920 × 1280
search canvas. They are template guidance, not a guaranteed crop rectangle.
Apple also provides universal Figma and Sketch templates, plus dedicated and
universal Pixelmator templates. Check each proposal in App Store Connect's
iPhone/iPad, orientation, and language previews before submission. The full
16:9 canvas should not be treated as guaranteed visible space.

## Verified API upload and placement flow

Use the public base URL `https://api.appstoreconnect.apple.com`. The sequence below
comes from Apple's [image upload guide][upload], [placement guide][place], and
linked request schemas. It describes API contracts, not runnable repository lanes.

1. **Discover the app library and specifications.** Resolve the numeric app ID for
   `app.trizum.capacitor`; `GET /v1/apps/{id}/assetLibrary` returns its
   `appAssetLibraries` ID. `GET /v1/appAssetLibraryRefData` provides `features`,
   `placementProfileGroups`, `placementTypes`, `imageSpecs`, and other arrays.
   Traverse feature policies, group limits, and `specMappings` to select accepted
   specifications. Group IDs are runtime strings, not device names to invent.
   Check `acceptsAssetCategories`, `alphaAllowed`, dimensions, formats, and
   `maxFileSize`. Treat absent features as unavailable. [Reference lookup][discover].

2. **Reserve an image.** `POST /v1/appAssetLibraryImages` takes JSON:API
   `data.type: "appAssetLibraryImages"`; required `data.attributes` are `fileName`,
   byte `fileSize`, and `category: "CREATIVE_ASSETS"`. Optional `referenceName`
   identifies the asset internally. Set
   `data.relationships.assetLibrary.data` to
   `{ "type": "appAssetLibraries", "id": "<library-id>" }`.
   The response returns the image ID and `uploadOperations`. [Image resources][images].

3. **Transfer bytes.** Execute every returned operation using its exact `method`,
   `url`, `requestHeaders`, `offset`, and `length`. These time-limited storage URLs
   take file bytes, not JSON, and must not receive the App Store Connect JWT.
   Complete all parts before committing. [Upload protocol][upload].

4. **Commit and poll.** `PATCH /v1/appAssetLibraryImages/{id}` takes
   `data.type: "appAssetLibraryImages"`, the same `data.id`, and
   `data.attributes.uploaded: true`. There is **no `sourceFileChecksum` field**
   in the library commit; do not copy the legacy screenshot payload. Poll
   `GET /v1/appAssetLibraryImages/{id}` through `UPLOAD_COMPLETE` until
   `PREPARE_FOR_SUBMISSION`. On `FAILED`, inspect `stateDetails`. Check the returned
   `specId` against the reference catalog; the client does not set it.
   [Update schema][image-update] and [processing behavior][upload].

5. **Assign each localization separately.** Read
   `GET /v1/appStoreVersions/{id}/appStoreVersionLocalizations` and select locale
   IDs. `POST /v1/appAssetLibraryPlacements` uses
   `data.type: "appAssetLibraryPlacements"`, attributes `placementType` and
   `placementGroup`, an `image` relationship with type `appAssetLibraryImages`,
   and exactly one target relationship, such as `appStoreVersionLocalization`
   with type `appStoreVersionLocalizations`. For these organic slots the
   [placement types][placement-types] are `PRODUCT_PAGE_HEADER_ASSET` and
   `APP_STORE_SEARCH_RESULTS_ASSET`; `SEARCH_RESULTS_ADS_ASSET` is a different slot.
   Obtain valid groups and limits from reference data. One compatible universal
   asset can back both placements and multiple localizations; translated artwork
   needs the corresponding assets. Custom pages, events, and experiment treatments
   have their own localization relationships. [Placement contract][place].

6. **Inspect placement state.** Read
   `GET /v1/appStoreVersionLocalizations/{id}/placements` or
   `GET /v1/appAssetLibraryPlacements/{id}`. Placement state follows its parent
   surface's review. Placements are immutable: replacement requires deleting and
   recreating a placement; removal preserves the underlying library asset.
   Invalid type/group/category combinations and noneditable parents produce 409
   errors. Check per-group limits before creating anything. [Placement resources][placements].

## Review, assignment, and publishing are separate

**Standalone asset review is supported.** Once an app has an approved version,
assets can be reviewed without placements or a new binary. With no approved app
version, include them with the first version. Assets already attached to an item
in an active submission cannot be submitted independently; assigned assets are
included when their parent is submitted. Standalone review uses the latest app
version for the chosen platform. [Submission rules][submit-help].

The documented standalone API building blocks are:

- [`POST /v1/reviewSubmissions`][review-create]: `data.type: "reviewSubmissions"`,
  `attributes.platform: "IOS"`, and `relationships.app.data` with type `apps` and
  the numeric app ID.
- [`POST /v1/reviewSubmissionItems`][item-create]:
  `data.type: "reviewSubmissionItems"` and relationships `reviewSubmission`
  (type `reviewSubmissions`) plus `appAssetLibraryImage` (type
  `appAssetLibraryImages`). Apple's [item relationship schema][item-relationships]
  explicitly includes library images and videos.
- [`PATCH /v1/reviewSubmissions/{id}`][review-update]:
  `data.type: "reviewSubmissions"`, matching `data.id`, and
  `attributes.submitted: true`. Read the submission and image states afterward;
  successful HTTP submission is not approval.

**Approval alone does not assign or publish artwork.** For an editable app version,
create placements and submit that version; its artwork goes live with the approved
version's release. Apple also documents choosing an already approved library asset
on a live version and clicking **Publish**, without a new app version. However,
the API placement guide says approved parents cannot accept new placements. An
API equivalent of that live-version Publish operation was **not verified** here;
do not promise that creating a placement publishes a live update. Use the
documented App Store Connect UI for that step until its API contract is established.
[Live-version publishing][manage] and [API parent-state restrictions][place].

## Adapter and future extensions

Reuse the existing `load_api_key` lane and three CI secrets. Fastlane's
[`app_store_connect_api_key` action][auth-source] defaults `set_spaceship_token`
to true. A custom adapter can construct
`Spaceship::ConnectAPI::Tunes::Client.new(token: Spaceship::ConnectAPI.token)`
and call its generic `get`, `post`, `patch`, and `delete` methods with public
`v1/...` paths. The [HTTP client][client-source] supplies JWT authentication and
refresh; read [`Response#body`][response-source] instead of `to_models` for these
unmodeled resources. This reuses existing authentication without requiring native
`deliver` support or a Fastlane upgrade. Apple's API guide requires Account Holder,
Admin, or App Manager access; the current key's effective permissions and account
feature availability were not tested. [API access requirements][library].

The implemented creative lane preflights a locale/type/file manifest, uploads
missing images or videos, records IDs, and attaches selected placements to an
editable release version.
Standalone review and live-version publishing remain separate future work.
Do not fold these into the screenshot folder or assume `sync_screenshots`,
`submit_for_review`, or `automatic_release` manages standalone creatives.

Bound polling and HTTP retries; report asset IDs, states, `stateDetails`, and Apple
error codes. `referenceName` is not a uniqueness guarantee: the creative lane rejects
ambiguous duplicate matches instead of choosing arbitrarily. Reconcile before
retrying an ambiguous POST. Preserve unrelated placements; do not copy screenshot
synchronization's removal semantics. Standalone review and durable cross-run recovery remain future work.

## User-provided context

The [Screenshot Bro article](https://screenshotbro.app/blog/app-store-creative-assets)
and the public excerpt of
[Halil Özel's article](https://halilozel1903.medium.com/the-app-store-just-got-product-page-headers-and-search-result-assets-210c805796b7)
motivated the investigation. The Medium story is member-only; its script and
paywalled remainder were not accessed. Technical conclusions above rely on Apple
documentation and Fastlane source, not those secondary articles.

[library]: https://developer.apple.com/documentation/appstoreconnectapi/understanding-the-app-asset-library
[manage]: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets
[release]: https://github.com/fastlane/fastlane/releases/tag/2.241.2
[upstream]: https://github.com/fastlane/fastlane/tree/708dcc6fd2a7c944b0417b0d59355c0f7dbe5a37
[deliver-source]: https://github.com/fastlane/fastlane/blob/2.241.2/deliver/lib/deliver/upload_screenshots.rb
[specs]: https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
[design]: https://developer.apple.com/app-store/asset-best-practices/
[review-guidelines]: https://developer.apple.com/app-store/review/guidelines/#accurate-metadata
[header-template]: https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-product_page_header_template-static.psd
[search-template]: https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-search_results_template-static.psd
[discover]: https://developer.apple.com/documentation/appstoreconnectapi/discovering-asset-specifications
[upload]: https://developer.apple.com/documentation/appstoreconnectapi/uploading-and-managing-image-assets
[images]: https://developer.apple.com/documentation/appstoreconnectapi/app-asset-library-images
[image-update]: https://developer.apple.com/documentation/appstoreconnectapi/appassetlibraryimageupdaterequest/data-data.dictionary/attributes-data.dictionary
[place]: https://developer.apple.com/documentation/appstoreconnectapi/placing-assets-on-your-app-store-surfaces
[placements]: https://developer.apple.com/documentation/appstoreconnectapi/app-asset-library-placements
[placement-types]: https://developer.apple.com/documentation/appstoreconnectapi/appassetlibraryplacementtype
[submit-help]: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-assets-from-asset-library
[review-create]: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-reviewsubmissions
[item-create]: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-reviewsubmissionitems
[item-relationships]: https://developer.apple.com/documentation/appstoreconnectapi/reviewsubmissionitemcreaterequest/data-data.dictionary/relationships-data.dictionary
[review-update]: https://developer.apple.com/documentation/appstoreconnectapi/patch-v1-reviewsubmissions-_id_
[auth-source]: https://github.com/fastlane/fastlane/blob/2.231.1/fastlane/lib/fastlane/actions/app_store_connect_api_key.rb
[client-source]: https://github.com/fastlane/fastlane/blob/2.231.1/spaceship/lib/spaceship/connect_api/api_client.rb
[response-source]: https://github.com/fastlane/fastlane/blob/2.231.1/spaceship/lib/spaceship/connect_api/response.rb
