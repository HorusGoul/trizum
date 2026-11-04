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
`oxc/no-accumulating-spread` companion rule. The installation initially enabled
the six rules without findings and disabled the failing rules, linking their
rollout issues beside the configuration entries. Each cleanup PR fixes one
rule and enables it in the same change.

The corrected installation baseline contained 87 module-mocking findings in
32 files, tracked under [#584](https://github.com/HorusGoul/trizum/issues/584).
The module-mocking cleanup layer replaces those mocks with explicit service
interfaces and real test implementations. All generic rules and the native
companion are now enabled at `error` at the top of the cleanup stack.

Linting and formatting exclude the vendored directory and project-local agent
assets. `oxlint` and `@oxlint/plugins` are pinned together in the workspace
catalog to match Vite+'s Oxlint version; update them together when upgrading
Vite+.
