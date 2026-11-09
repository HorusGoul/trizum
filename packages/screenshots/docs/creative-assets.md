# App Store creative assets

Read this when editing header animation or search artwork, previewing a new
iteration, or selecting reviewed output for a future App Store release.

## Editable sources

All source lives in [`src/creative-assets`](../src/creative-assets/):

| File                                  | Edit here for                                                    |
| ------------------------------------- | ---------------------------------------------------------------- |
| `data.ts`                             | Palette, people, expense amounts, balance states, localized copy |
| `motion.ts`                           | Easing, springs, counter interpolation                           |
| `svg.ts`                              | Logo, wordmark, blob characters, text alignment                  |
| `characters.ts`                       | Character movement, balances, repayments                         |
| `receipts.ts`                         | Receipt layout, stacking, combined total                         |
| `header.ts`                           | Header composition, headings, ending and loop                    |
| `search-concepts.ts`                  | Original search concepts A/B/C, copy and layout                  |
| `render.ts`                           | Playwright frames, PNGs, video encoding, standalone preview      |
| `preview-controls.ts`, `preview.html` | Local playback, language and framing controls                    |
| `manifest.ts`, `schema.ts`            | File inspection and explicit release selection                   |

The original search concepts remain drafts; the approved header is the current
release selection. Header financial examples use integer cents. When changing
expenses or repayments, update the matching story amounts and states together;
the ledger tests check zero-sum balances and settlement through every frame.

## Prerequisites

Run `vp install` from the repository root. From `packages/screenshots`, run
`vp run setup` for Chromium. Install FFmpeg and ffprobe on your machine for video
encoding and validation; they must be on `PATH`, or set `FFMPEG_BINARY` and
`FFPROBE_BINARY`. The Inter variable font is a pinned package dependency;
generation copies its license next to the output.

The following commands run from `packages/screenshots`. Output defaults to the
ignored `creative-assets/` directory. Every generation command also accepts
`--output <directory>`. No generation command changes the selected release
assets or contacts App Store Connect.

## Header preview and export

```bash
vp run creative:preview
```

This generates English and Spanish keyframes plus a self-contained
`creative-assets/preview.html`. Open that file directly; no server is needed.
It starts paused and supports play/pause, seeking, both languages, the full
header canvas, and the enlarged safe area. Use it for quick layout/motion edits.

```bash
vp run creative:header
```

This additionally encodes the full English and Spanish master MP4s under
`creative-assets/header/<locale>/header.mp4`. The renderer produces a silent
3840 × 1646 H.264 video at 60 fps for 20 seconds, using the same drawing code as
the preview. It verifies matching source loop endpoints. Poster/keyframe PNGs
are written alongside the videos. `header.png` is a static candidate of the
poster frame. Encoding can take several minutes.

## Search concepts

```bash
vp run start
vp run creative:search
```

Search concepts A and B use real, deterministic app captures. The normal
screenshot capture command must have populated `.captures/<locale>/iphone-6.9/`
with `expense-log.portrait.png` and `balances.portrait.png`; see the
[capture guide](./capture.md) for the app/server prerequisites and filtered
captures. Concept C uses brand illustrations.

The generator writes all three original concepts in both languages to
`creative-assets/search/<a|b|c>/<locale>/search.png`, with standalone HTML next
to each PNG. Files are RGB, without alpha, at 1920 × 1280. The source retains the
original proposals for later editing and review; generation does not select one
for publication.

## Select reviewed artwork for the next release

After reviewing a header export:

```bash
vp run creative:prepare --kind header --from creative-assets/header --media video --poster-time-code 00:00:10:48
```

After reviewing a search concept, for example B:

```bash
vp run creative:prepare --kind search --from creative-assets/search/b --media image
```

Selection requires both `en-US` and `es-ES` files. It validates every locale
before changing release files, inspects MP4 dimensions/fps/duration/audio,
rejects PNG alpha, checks placement dimensions, and validates video poster
timecodes. It copies the reviewed outputs into the mobile Fastlane
`creative_assets/` directory and updates its `manifest.json` with their SHA-256
hashes and media metadata. Video reference posters are extracted at the selected
timecode. Selecting search artwork preserves the selected headers and vice versa.
The same delivery workflow supports a future search MP4 or a static header PNG;
use the corresponding media type and placement dimensions.

```bash
vp run creative:validate
vp run check
vp run test
```

Review the source, selected files, and manifest diff together, then commit them.
Keep generated review previews out of Git. The selected masters are deliberately
tracked so a release uploads the reviewed bytes rather than regenerating
unreviewed output in CI. Encoder versions may produce different MP4 bytes; a
reviewed regeneration receives its own content hash.

## Upload and publication

The normal mobile `deploy_appstore_full` lane calls `upload_creative_assets`
after metadata upload and before submitting its editable version for review.
It reads only the selected manifest, discovers Apple's current specifications
and compatible iPhone/iPad groups, uploads missing images/videos, and attaches
placements for each selected locale/type. It prepares every selected asset before
replacing any slot, reuses matching assets/placements, and preserves other slots.

For authenticated preflight without upload or placement changes, from the
repository root:

```bash
(cd packages/mobile/ios/App && mise exec -- bundle exec fastlane upload_creative_assets app_version:1.14.0 preflight:true)
```

Replace the example version with the actual editable release version. Header
and search artwork is reviewed and published with that app release. Merging
sources or selecting files locally does not publish anything immediately.
See the mobile [creative asset guide](../../mobile/docs/app-store-creative-assets.md)
for Apple API contracts, review rules, and processing reports.
