# trizum - AI Agent Guide

This file is the repo entry point for coding agents. It should stay small,
stable, and focused on routing.

## What trizum is

`trizum` helps people split bills with friends, family, and roommates. The repo
is centered on an offline-first PWA backed by Automerge, with mobile wrappers,
a sync server, and tooling for release screenshots.

## Start Here

Read these sources in order:

1. this file for repo-wide workflow and guardrails,
2. [`docs/agent-knowledge-map.md`](./docs/agent-knowledge-map.md) for the
   source-of-truth map of agent-facing surfaces,
3. the package README for the area you are changing,
4. any deeper `AGENTS.md` in that domain,
5. the relevant skill under [`.agents/skills`](./.agents/skills),
6. the package's `package.json` for exact commands.

Canonical examples:

- [`.nvmrc`](./.nvmrc) and [`package.json`](./package.json) are the source of
  truth for Node, pnpm, and workspace scripts.
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

1. Ask which branch to work from before starting code changes.
2. Create a new branch. Never work directly on `main` or another base branch.

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

- Use `nvm use`, then `pnpm install` when setting up locally.
- Before opening a PR, run the standard root validation commands defined in
  [`package.json`](./package.json): `pnpm test`, `pnpm lint`, and
  `pnpm typecheck`.
- Run `pnpm lingui:extract` when user-facing copy changes.
- Create a changeset before opening a PR for user-facing changes, and have the
  agent do it when possible. Use
  [`.agents/skills/creating-changesets/SKILL.md`](./.agents/skills/creating-changesets/SKILL.md)
  for the workflow and bump guidance.
- Keep commits small and descriptive.

### Workflow Safety

- Do not push directly to `main`.
- Do not force-push with `git push --force`.
- Do not delete branches without asking.
- Do not merge PRs; humans review and merge.

## Skills

Project-local skills live in [`.agents/skills`](./.agents/skills). Use them for
repeatable workflows such as browser automation, push and PR handling,
changeset creation, or generated-file regeneration. Keep project-local skill
content there instead of duplicating it in general docs.
