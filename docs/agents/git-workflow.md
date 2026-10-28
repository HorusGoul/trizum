# Git workflow

Read this before editing files or performing branch, commit, or PR operations.

## Branches

- Create a new branch before editing. Never work directly on `main` or another
  base branch.
- Default to `main` as the base branch; use another base when the user or
  task context calls for it. Mention the chosen base in a progress update.
  Ask only when the starting point is ambiguous or risky.
- Use `type/description` names: `feature/`, `fix/`, `refactor/` (no behavior
  changes), `docs/`, `chore/`, or `test/`.

## Commits and pull requests

- Keep commits small and descriptive.
- Use Conventional Commit PR titles, such as
  `refactor(pwa): migrate animations to motion`.
- Follow [validation and release requirements](./validation-and-releases.md)
  before opening a PR.
- Do not push directly to `main` or use `git push --force`.
- Queue a PR for merging only when the user explicitly requests merging,
  landing, or queueing it. Creating, updating, reviewing, or monitoring a PR
  does not authorize queueing it: Mergify can merge automatically.
- Use a PR comment containing exactly `@mergifyio queue` through the `land`
  skill. Let Mergify perform the merge; do not merge directly with `gh pr merge`
  or enable GitHub auto-merge.
- Merged PR branches may be deleted without asking. Ask before deleting other
  branches. GitHub's automatic deletion of merged head branches needs no
  additional approval.

Use the [commit](../../.agents/skills/commit/SKILL.md),
[pull](../../.agents/skills/pull/SKILL.md),
[push](../../.agents/skills/push/SKILL.md), or
[land](../../.agents/skills/land/SKILL.md) skill when the task matches that
workflow. Keep procedural details in those skills.
