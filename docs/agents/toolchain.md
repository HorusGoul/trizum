# Toolchain setup

Read this when setting up the workspace, updating dependencies, or diagnosing
runtime and package-manager problems.

## Sources of truth

- [`.node-version`](../../.node-version): Node version.
- [`mise.toml`](../../mise.toml): native-tooling Ruby version.
- [`package.json`](../../package.json): pnpm version and workspace scripts.
- [`vite.config.ts`](../../vite.config.ts): Vite+ configuration and workspace tasks.
- Each package's `package.json` and `vite.config.ts`: package commands.

The workspace supports Node.js 26. Development and CI use `.node-version`;
both server Docker stages use the matching Node 26 image tag. Keep the root
`engines.node`, Node type catalog, runtime pin, and Docker tag coordinated.
Native TypeScript scripts use Node's type stripping and must use erasable
syntax. Node 26 removed `--experimental-transform-types`.

Use pnpm through Vite+ (`vp`). Workspace commands are listed in the
[root guide](../../AGENTS.md); use `vp run <task-or-script>` so workspace tasks
and package scripts run their prerequisites. The workspace root rejects direct
`vp dev` and `vp build` commands.

For local PWA development and preview, run `vp run dev` and `vp run preview`
from the workspace root.

The root `prepare` script uses `vp config --no-agent` to install hooks without
rewriting `AGENTS.md`. Keep that flag so installs preserve the minimal guide.

## T3 Code worktrees

See [`t3.json`](../../t3.json) for worktree actions and
[`scripts/setup-worktree.sh`](../../scripts/setup-worktree.sh) for setup.

## Troubleshooting

If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor`
and include its output when asking for help.

Use `vp help` or `vp <command> --help` for CLI usage. Vite+ documentation is
available in `node_modules/vite-plus/docs` after installation.
