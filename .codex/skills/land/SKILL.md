---
name: land
description:
  Merge a PR safely by handling conflicts, review feedback, and CI until the PR
  is squash-merged.
---

# Land

## Preconditions

- `gh` is authenticated.
- You are on the PR branch.
- The working tree is clean, or any local changes are committed and pushed first.

## Steps

1. Locate the PR for the current branch with `gh pr view`.
2. Check mergeability:
   - if the PR conflicts with `main`, run the `pull` skill and then the `push` skill.
3. Sweep review feedback before merging:
   - top-level issue comments,
   - inline review comments,
   - review summaries/states,
   - any Codex review comments.
4. For each actionable comment, choose one:
   - accept and fix it,
   - clarify,
   - push back with a concise rationale.
5. After any code change:
   - run the repo validation gate,
   - commit,
   - push,
   - re-check review state.
6. Wait for `gh pr checks --watch` to finish cleanly.
7. Only when checks are green and no actionable feedback remains, squash-merge the PR.
8. Move the Linear issue to `Done`.

## Notes

- Do not enable auto-merge.
- Do not merge while human review comments remain unresolved.
- Keep PR title and body aligned with the full scope of the branch.
