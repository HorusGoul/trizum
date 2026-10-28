# Mobile releases and CI

[Back to package overview](../README.md). Read when validating native changes or publishing builds. Configure [signing and CI secrets](./signing.md) before release workflows.

## GitHub Actions

The `CI` workflow includes a `Check Android` job that performs an Android
Capacitor sync check, then runs Gradle lint, unit tests, debug APK assembly, and
release AAB bundling without Play Store or release signing credentials. Use
this as the required dry-run for Gradle, Android Gradle Plugin, SDK, or native
Android project changes.

A `workflow_dispatch` workflow is available for building mobile apps in CI. Navigate to **Actions > Mobile Build** in GitHub and select:

- **Platform**: `android`, `ios`, or `both`
- **Build type**: `debug` or `release`
- **Android artifact**: `apk` or `aab` (for release builds)
- **iOS export method**: `app-store` or `ad-hoc` (for release builds)

Add the `android:internal-testing` label to a non-fork pull request to build
signed Android APK and AAB artifacts from the PR head, upload the AAB to the
Google Play internal testing track, and comment on the PR with links to both
artifacts. The workflow computes a temporary Android `versionCode` from the
highest version code already present in Play Store tracks and fails before it
reaches the next release version-code range, so PR uploads do not silently block
the next production patch release. After a successful internal release and PR
comment, the workflow removes the label.

Add the `ios:testflight` label to a non-fork pull request to build a signed iOS
release from the PR head and upload it to TestFlight. The workflow computes a
temporary iOS version/build pair from the next patch TestFlight train, then
fails before it reaches the following patch's build-number range. This avoids
uploading to a released App Store train that App Store Connect has already
closed for new pre-release builds. After a successful TestFlight upload, the
workflow comments on the PR with the TestFlight version/build details and
removes the label.

Published, non-prerelease GitHub releases tagged as `@trizum/mobile@*` also
trigger the shared release workflow. That path reuses the mobile build and
store deployment workflows to generate store screenshots, publish Android to the
Play Store production track with `release_status` `completed`, upload the iOS
build and store metadata with `automatic_release` enabled, and
attach the signed Android APK and AAB to the GitHub release.

iOS review submission is temporarily manual for the first Premium release.
After the uploaded build finishes processing, select it in App Store Connect
and add the app version to the prepared review submission containing the Premium
products, then submit them together. Restore `submit_for_review: true` in the
release workflow after Apple approves the combined submission and no pending
review submission remains. Repository metadata, including release and review
notes, continues to overwrite the corresponding App Store Connect fields.
