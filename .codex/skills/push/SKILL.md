---
name: push
description:
  Push the current branch to `origin`, create or update the PR, and keep PR
  metadata aligned with this repo's workflow.
---

# Push

## Required gate

Run these before every push:

- `pnpm lingui:extract`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`

If the change is user-facing, ensure a changeset exists before pushing.

## Steps

1. Identify the current branch and inspect existing PR state with `gh pr view`.
2. Run the required validation gate.
3. Push to `origin`:
   - `git push -u origin HEAD`
4. If push fails because the remote moved, run the `pull` skill, rerun validation, and push again.
5. If the current branch is tied to a closed or merged PR, create a fresh branch and open a new PR.
6. Ensure a PR exists:
   - create one if missing,
   - otherwise update the existing one.
7. Fill the PR body using `.github/PULL_REQUEST_TEMPLATE.md`.
8. Ensure the PR title still matches the full scope of the branch.
9. Ensure the PR has the `symphony` label:
   - create it if needed,
   - add it to the PR if missing.
10. Reply with the PR URL.

## Notes

- Do not use `--force`; use `--force-with-lease` only when the branch history was intentionally rewritten.
- Surface auth or permission failures directly instead of changing remotes as a workaround.
