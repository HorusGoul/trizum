# Validation and releases

Read this when validating changes or preparing a PR or release.

## Validation

- Run `vp run check` and `vp run test` for changes.
- Before opening a PR, also run `vp run build`.
- Run these commands from the workspace root. Use `vp run check --fix` when
  applying formatting and lint fixes.
- Check the affected package's `vite.config.ts`, `package.json`, and README for
  additional validation tasks; run them with `vp run <task-or-script>`.
- Expense calculations and other critical business logic require tests; see
  [coding conventions](./coding.md).
- For user-facing copy changes, follow the extraction and localization rules
  in [PWA conventions](./pwa.md).

## Release notes

Create a changeset before opening a PR for user-facing changes. Use the
[creating-changesets skill](../../.agents/skills/creating-changesets/SKILL.md)
for the workflow and version-bump guidance.
