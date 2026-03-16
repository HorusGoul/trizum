---
name: commit
description:
  Create a well-formed git commit for this repo, including required Lingui
  extraction and a message that matches the staged changes.
---

# Commit

## Repo rules

- Run `pnpm lingui:extract` before every commit.
- If the change is user-facing, confirm a changeset exists before committing.
- Do not rely on interactive prompts in unattended runs. Add the changeset
  markdown file directly if needed instead of launching interactive flows.
- Do not commit unrelated files.

## Steps

1. Inspect `git status`, `git diff`, and `git diff --staged`.
2. Run `pnpm lingui:extract`.
3. If the change is user-facing and there is no changeset yet, add the
   `.changeset/*.md` file directly.
4. Stage only the intended files.
5. Write a conventional commit subject that matches the change:
   - `feat(...)`
   - `fix(...)`
   - `refactor(...)`
   - `docs(...)`
   - `chore(...)`
   - `test(...)`
6. Add a short body covering:
   - what changed,
   - why it changed,
   - validation run.
7. Append `Co-authored-by: Codex <codex@openai.com>`.
8. Commit with `git commit -F <file>` so newlines are preserved literally.

## Template

```text
<type>(<scope>): <short summary>

Summary:
- <what changed>

Rationale:
- <why>

Tests:
- <command or "not run (reason)">

Co-authored-by: Codex <codex@openai.com>
```
