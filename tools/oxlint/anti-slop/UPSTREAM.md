# anti-slop provenance

- Source: <https://github.com/dmmulroy/anti-slop>
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7`
- Source directory: `skills/install-anti-slop/assets/anti-slop/`
- Installed directory: `tools/oxlint/anti-slop/`
- Generic entry point: `index.ts`, enabled in the root `vite.config.ts`.
- Optional Effect entry point: `effect/index.ts`, copied but not enabled because
  this workspace has no direct Effect dependency.

All 38 bundled files were verified against their Git blob hashes at the source
commit. There are no changes to the copied files; this provenance record is the
only added file. Preserve the nested `vendor/eslint-stylistic/LICENSE` and
`vendor/eslint-stylistic/UPSTREAM.md` when updating.

The root Vite+ configuration registers all generic rules and the native
`oxc/no-accumulating-spread` companion rule. Rules with existing violations start
at `off`, with their rollout issues linked beside the configuration entries.
The seven rules without findings remain enabled at `error`. Each cleanup PR
resolves one rule’s findings and enables it in the same change. Linting and formatting exclude the
vendored directory and project-local agent assets. `oxlint` and `@oxlint/plugins`
are pinned together in the workspace catalog to match Vite+'s Oxlint version;
update them together when upgrading Vite+.
