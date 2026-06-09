# trizum - AI Agent Guide

This file is the repo entry point for coding agents. It should stay small,
stable, and focused on routing.

## What trizum is

`trizum` helps people split bills with friends, family, and roommates. The repo
is centered on an offline-first PWA backed by Automerge, with mobile wrappers,
a sync server, and tooling for release screenshots.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp run check` and `vp run test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <task-or-script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Start Here

Read these sources in order:

1. this file for repo-wide workflow and guardrails,
2. [`docs/agent-knowledge-map.md`](./docs/agent-knowledge-map.md) for the
   source-of-truth map of agent-facing surfaces,
3. the package README for the area you are changing,
4. any deeper `AGENTS.md` in that domain,
5. the relevant skill under [`.agents/skills`](./.agents/skills),
6. the package's `vite.config.ts` and `package.json` for exact commands.

Canonical examples:

- [`.node-version`](./.node-version), [`.mise.toml`](./.mise.toml),
  [`package.json`](./package.json), and [`vite.config.ts`](./vite.config.ts)
  are the source of truth for Node, native-tooling Ruby, the package manager,
  and Vite+ workspace commands.
- [`.agents/skills/creating-changesets/SKILL.md`](./.agents/skills/creating-changesets/SKILL.md)
  is the source of truth for creating changesets when a user-facing change
  needs release notes or a version bump.
- [`packages/pwa/README.md`](./packages/pwa/README.md) is the package entry
  point for most product work.
- [`packages/pwa/locale/AGENTS.md`](./packages/pwa/locale/AGENTS.md) is the
  source of truth for translation terminology.
- [`packages/server/README.md`](./packages/server/README.md) and
  [`packages/mobile/README.md`](./packages/mobile/README.md) are specialist
  entry points for those packages.
- [`packages/screenshots/README.md`](./packages/screenshots/README.md) is a
  specialist doc and should not be part of the default read path for normal app
  work.

## Repo-Wide Rules

### Branching

1. If the user does not specify a base branch, pick a sensible default yourself
   (usually the current `main` or remote default branch) and mention that
   assumption in your progress update.
2. Create a new branch before editing. Never work directly on `main` or another
   base branch.
3. Only stop to ask about the base branch when the correct starting point is
   ambiguous or risky.

Use `type/description` naming:

- `feature/` for new features
- `fix/` for bug fixes
- `refactor/` for refactors without behavior changes
- `docs/` for documentation work
- `chore/` for maintenance
- `test/` for test-focused changes

### Code And Product Guardrails

- TypeScript is required for all code.
- Prefer React patterns over non-React alternatives.
- Do not add `useMemo`, `memo`, or `useCallback` by default.
- User-facing strings must use Lingui.
- Use the `accent` color scale and explicit `dark:` variants in the PWA.
- Expense calculations and other critical business logic need tests.
- Use Automerge for persisted or shared collaborative state; use normal React
  state for local UI state.
- Do not edit generated files such as `routeTree.gen.ts` manually.

### Validation And Release Hygiene

- Use `vp install` when setting up locally.
- Before opening a PR, run the standard Vite+ validation commands:
  `vp run check`, `vp run test`, and `vp run build`.
- From the workspace root, use `vp run check --fix` when you need Vite+ to
  apply formatting and lint fixes.
- From the workspace root, run PWA dev and preview through package tasks:
  `vp run dev` and `vp run preview`.
- Run `vp run lingui:extract` when user-facing copy changes.
- Create a changeset before opening a PR for user-facing changes, and have the
  agent do it when possible. Use
  [`.agents/skills/creating-changesets/SKILL.md`](./.agents/skills/creating-changesets/SKILL.md)
  for the workflow and bump guidance.
- Keep commits small and descriptive.

### Workflow Safety

- Do not push directly to `main`.
- Do not force-push with `git push --force`.
- Do not delete branches without asking.
- Use Conventional Commit format for pull request titles, such as
  `refactor(pwa): migrate animations to motion`.
- Do not merge PRs; humans review and merge.

## Skills

Project-local skills live in [`.agents/skills`](./.agents/skills). Use them for
repeatable workflows such as browser automation, push and PR handling, or
changeset creation. Keep project-local skill content there instead of
duplicating it in general docs.
