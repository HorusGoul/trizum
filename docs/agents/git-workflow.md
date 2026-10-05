# Git workflow

Read this before editing files or performing branch, commit, or PR operations.

## Branches

- Create a new branch before editing. Never work directly on `main` or another
  base branch.
- If the user does not specify a base branch, choose a sensible default
  (usually the current `main` or remote default branch) and mention the
  assumption in a progress update. Ask only when the starting point is
  ambiguous or risky.
- Use `type/description` names: `feature/`, `fix/`, `refactor/` (no behavior
  changes), `docs/`, `chore/`, or `test/`.

## Commits and pull requests

- Keep commits small and descriptive.
- Use Conventional Commit PR titles, such as
  `refactor(pwa): migrate animations to motion`.
- Follow [validation and release requirements](./validation-and-releases.md)
  before opening a PR.
- Do not push directly to `main` or use `git push --force`.
- Merge a PR only when the user explicitly requests merging or landing it.
  Creating, updating, or reviewing a PR does not authorize merging it.
- Merged PR branches may be deleted without asking. Ask before deleting other
  branches. GitHub's automatic deletion of merged head branches needs no
  additional approval.

Use the [commit](../../.agents/skills/commit/SKILL.md),
[pull](../../.agents/skills/pull/SKILL.md),
[push](../../.agents/skills/push/SKILL.md), or
[land](../../.agents/skills/land/SKILL.md) skill when the task matches that
workflow. Keep procedural details in those skills.
