# ChatGPT directory release package

Edit this configuration when changing the public listing, connection, review
cases or brand assets. Add an `@trizum/mcp` changeset for these changes so the
next MCP release contains an updated submission ZIP.

- [plugin.json](./plugin.json) owns the listing name, publisher, descriptions,
  prompts, public URLs, five positive and three negative review cases, country
  availability and Spanish listing translation. The empty country list allows
  all supported countries; set an explicit allowlist if needed.
- [mcp.json](./mcp.json) connects the portable package to the production HTTPS
  MCP endpoint with no authentication. Use the permanent production URL.
- [assets.json](./assets.json) maps ZIP paths to selected PNG files, relative to
  the MCP package directory. The defaults reuse the PWA's existing brand images.

The builder derives `version` from `packages/mcp/package.json` and
`publication.release_notes` from that version's `CHANGELOG.md` section. Do not
duplicate those values in the configuration. There are no build timestamps or
credentials in the ZIP. Only `plugin.json`, `mcp.json` and explicitly mapped image
files are included; source code and unrelated files are excluded.

## Build and inspect locally

From the workspace root:

```sh
vp run --filter @trizum/mcp package:submission
```

This builds the MCP package first, validates the configuration and referenced PNG
assets, and writes these ignored files under `packages/mcp/artifacts/`:

- `trizum-chatgpt-<mcp-version>.zip`
- `trizum-chatgpt-<mcp-version>.zip.sha256`

The MCP check task also builds this archive, so regular CI validates the actual
release configuration, version's changelog entry and selected images.

The ZIP has portable `plugin.json` and `mcp.json` at its root, plus `assets/`.
It contains the hosted connection settings and listing materials; the MCP server
and widget continue to run on the existing Worker.

## GitHub release attachment

The Release workflow's **Attach MCP ChatGPT Submission** job runs when a stable
`@trizum/mcp@<version>` GitHub release is published. It checks out that exact tag,
builds the archive and attaches the ZIP and checksum to that MCP release using
the job's GitHub token. The tag must match the checked-out package version.
Retries replace assets with the same names. PWA and mobile release events do not
run this job, and prereleases are excluded.

The first MCP release containing this packaging workflow will have the assets.
Existing releases are not backfilled. Packaging is independent of the production
deployment, so check that the production server is running the intended tools
before uploading its ZIP to OpenAI.

## Complete the submission

Download the ZIP from the MCP GitHub release and follow the official
[submission guide](https://developers.openai.com/plugins/deploy/submission).
This automation creates the package; it does not upload it to OpenAI or publish
the listing.

Before submitting, run the configured review prompts against the production app
and confirm the expected behavior. Add a real, reviewer-accessible video URL as
`extensions.com.openai.review.demo_recording_url` in `plugin.json`; it is omitted
until a recording exists. The package can be generated and uploaded without that
optional ZIP field, but OpenAI requires the recording for MCP review. Omitting it
preserves an existing portal value. The build prints a reminder while it is absent.

The listing uses the supported `Finance` category for shared-expense tracking and
bill splitting. If the portal cannot confirm the category, check the category and
description imported under Metadata & Skills and rerun its checks after uploading
the new package. A local build does not establish that its classification check
will accept the listing.

For an "Incomplete review information" finding, check Review information → Review
details. The ZIP supplies five positive cases, three negative cases, commerce
details and release notes. A real walkthrough recording is still required; record
the configured cases against the production app, add its accessible URL, and
upload the updated package. No reviewer login is needed for the anonymous MCP.

Complete publisher identity verification and the domain challenge in the portal,
review its automated tool/UI checks, and submit the draft. Keep credentials and
reviewer access details in the portal rather than these public files. The local
validator checks our configured package fields, not every OpenAI review rule;
portal checks and approval are still required.

The portable manifest and MCP connection follow OpenAI's
[package format](https://developers.openai.com/plugins/build/plugins).
