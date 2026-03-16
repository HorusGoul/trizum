---
name: pull
description:
  Sync the current branch with `origin/main` using a merge workflow and resolve
  conflicts safely for this repository.
---

# Pull

## Steps

1. Confirm the working tree is clean, or commit/stash before merging.
2. Enable rerere locally:
   - `git config rerere.enabled true`
   - `git config rerere.autoupdate true`
3. Fetch the latest refs:
   - `git fetch origin`
4. Sync the current branch with its remote first:
   - `git pull --ff-only origin $(git branch --show-current)`
5. Merge `origin/main` with conflict context:
   - `git -c merge.conflictstyle=zdiff3 merge origin/main`
6. If conflicts appear:
   - inspect intent on both sides before editing,
   - resolve one file at a time,
   - stage the resolved files,
   - complete the merge commit.
7. Run the repo validation needed for the current point in the workflow.
8. Record a short summary of the merge result in the Linear workpad.

## Conflict guidance

- Prefer minimal, intention-preserving resolutions.
- For generated files, resolve source conflicts first and regenerate the output if needed.
- For import conflicts, keep both candidates temporarily and let lint/typecheck tell you what is actually needed.
- After resolving conflicts, run `git diff --check`.
