# anti-slop provenance

- Source: <https://github.com/dmmulroy/anti-slop>
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7`
- Source directory: `skills/install-anti-slop/assets/anti-slop/`
- Installed directory: `tools/oxlint/anti-slop/`
- Generic entry point: `index.ts`, enabled in the root `vite.config.ts`.
- Optional Effect entry point: `effect/index.ts`, copied but not enabled because
  this workspace has no direct Effect dependency.

All 38 bundled files were initially verified against their Git blob hashes at
the source commit. That commit remains the pristine baseline. The following
local integration fix is intentional:

- `rules/no-module-mocking.ts` also recognizes named `vi` imports, including
  aliases, from `vite-plus/test`, the repository's supported Vitest entry point.
  This preserves upstream detection for `vitest`, Jest, globals, and shadowed
  bindings. Regression coverage lives in the repository-owned
  `../no-module-mocking.test.ts` and runs through `vp run test:lint-plugins` and
  the root `vp run test` task. No other vendored rule was modified.

This provenance record is repository-owned. Preserve the nested
`vendor/eslint-stylistic/LICENSE` and `vendor/eslint-stylistic/UPSTREAM.md` when
updating.

The root Vite+ configuration registers all generic rules and the native
`oxc/no-accumulating-spread` companion rule. Rules with existing violations start
at `off`, with their rollout issues linked beside the configuration entries.
The six rules without findings remain enabled at `error`. The corrected Vite+
module-mocking baseline has 87 findings in 32 files and is explicitly deferred
under [#584](https://github.com/HorusGoul/trizum/issues/584), alongside the
original twelve failing rules. Each cleanup PR resolves one rule’s findings and
enables it in the same change. Linting and formatting exclude the vendored
directory and project-local agent assets. `oxlint` and `@oxlint/plugins`
are pinned together in the workspace catalog to match Vite+'s Oxlint version;
update them together when upgrading Vite+.
