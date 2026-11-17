# @trizum/mcp

## 0.3.0

### Minor Changes

- [#641](https://github.com/HorusGoul/trizum/pull/641) [`72c82a8`](https://github.com/HorusGoul/trizum/commit/72c82a889193caaabc3b194f650f5ccdf92bb16d) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Build a versioned ChatGPT directory submission ZIP from committed listing,
  review-case, MCP-connection and asset configuration. Reuse existing trizum brand
  images, derive the package version and release notes from the MCP release, and
  include a SHA-256 checksum. Attach both files to stable MCP GitHub releases.
  Validate the generated package locally without uploading to OpenAI; publisher
  verification, the demo recording and final submission remain portal steps.

## 0.2.0

### Minor Changes

- [#592](https://github.com/HorusGoul/trizum/pull/592) [`90d588b`](https://github.com/HorusGoul/trizum/commit/90d588b24781e1854417fd42a4d12f3f835a8171) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Add an anonymous ChatGPT app and MCP endpoint for creating and managing shared
  expense groups without signing in. Support party details, participant additions,
  renaming and archival/restoration, plus expense reads, creation, edits and deletion.
  Reuse existing Automerge models, money and expense helpers, and balance calculation.

  Execute MCP tools directly through on-demand Automerge sync, without D1 access,
  request IDs, signed tokens, preparation calls or retry bookkeeping. Repeated
  creations produce separate groups or expenses. Existing reads and version-checked
  expense deletion let agents inspect and resolve unwanted duplicates. Keep edge
  write limits and count anonymous completed tool actions through shared analytics.
  Remove the experimental retry table with migration 0008 while preserving the
  already-applied 0007 migration in history, and remove its cleanup schedule.

  Publish independent expense and balance documents before linking them to the
  group, preserving concurrent additions. Patch existing records without replacing
  identities, attachments, custom splits or unspecified fields. Return a known group
  link when a new party's sync acknowledgement cannot be confirmed.
  Support creating expenses in different currencies using shared web reference-rate
  lookup and edge caching, or a user-supplied exchange rate. Reuse PWA conversion,
  rounding and split helpers, keeping balances in the party currency while saving
  original amounts and shares. Expose saved conversion details on expense reads.
  Reject missing or invalid conversions before publishing expense documents.
  Preserve conversion metadata during name/date edits and direct financial edits
  of converted expenses to trizum. Preserve participant payment methods during
  renaming and archival/restoration. Integrate with the shared Worker telemetry
  entry point while retaining independent receipt and MCP rate limits.

  Build the embedded widget with shared trizum UI components, fonts, icons and theme
  colors. Follow host light/dark themes, keep previously published widget URLs
  readable, embed all assets, and include responsive padding in host height
  measurements. Use host-mediated navigation and a copyable fallback.
  Describe the widget's contents to ChatGPT and request brief confirmations without
  duplicating its balances, expenses and links in the assistant response. Retain
  text summaries for explicit requests and clients without widget support.
  Return presentation guidance alongside successful party results instead of a
  second JSON copy, preserving the full structured data for follow-up actions.

  Return canonical app-associated invite URLs from all MCP hosts. Installed apps can
  open directly; browser visitors receive app-download or web choices on a separate
  custom domain hosted by the same Worker. Identify the download page with the
  sign-in screen's small logo treatment beside the lowercase trizum name and a
  "Your party is ready" heading, localized in English and Spanish.
  Use consistent Grupo terminology in the Spanish download-page copy and document
  the direct mutation tools' rate limits without obsolete signing requirements.
  Space the branding, headings and sections consistently, with a
  separate emoji gap and aligned wrapping for long group names. Keep mobile content
  near the top with comfortable padding. Preserve the party through desktop QR codes, invite copying
  and the existing web join flow. Track only approved campaign labels under existing
  analytics privacy gates, with no deferred-install tracking.
