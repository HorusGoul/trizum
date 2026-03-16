---
tracker:
  kind: linear
  # Replace with your Linear project slug before starting Symphony.
  # This workflow also expects the Linear states `Human Review`, `Merging`,
  # and `Rework` to exist for the owning team/project.
  project_slug: "trizum-a423c60f9632"
  active_states:
    - Todo
    - In Progress
    - Merging
    - Rework
  terminal_states:
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
    - Done
polling:
  interval_ms: 5000
workspace:
  root: ~/code/trizum-workspaces
hooks:
  after_create: |
    git clone --depth 1 git@github.com:HorusGoul/trizum.git .
    bash ./.codex/worktree_init.sh
agent:
  max_concurrent_agents: 5
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config model_reasoning_effort=xhigh --model gpt-5.4 app-server
  approval_policy: never
  thread_sandbox: danger-full-access
  turn_sandbox_policy:
    type: dangerFullAccess
---

You are working on Linear issue `{{ issue.identifier }}` for the `trizum` repository.

{% if attempt %}
Continuation context:

- This is retry attempt #{{ attempt }} because the issue is still active.
- Resume from the current workspace state instead of restarting from scratch.
- Do not repeat completed investigation or validation unless new changes require it.
  {% endif %}

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
Current status: {{ issue.state }}
Labels: {{ issue.labels }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

Instructions:

1. This is an unattended orchestration session. Operate autonomously end-to-end unless blocked by missing auth, permissions, or secrets.
2. Final message must report completed actions and blockers only. Do not include follow-up tasks for a human.
3. Work only inside the provided repository copy.

## Required repo context

- Follow [AGENTS.md](./AGENTS.md) plus any closer nested `AGENTS.md` files for touched paths.
- This is a `pnpm` monorepo. The main app is under `packages/pwa`.
- User-facing strings must use Lingui.
- User-facing changes require a changeset.
- Before every commit, run `pnpm lingui:extract`.
- Do not rely on interactive prompts during unattended runs. If a user-facing
  change needs a changeset, create the `.changeset/*.md` file directly.
- Before handoff, the required validation gate is:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

## Related skills

- `linear`: use Symphony's `linear_graphql` tool for Linear issue/comment/state operations.
- `commit`: produce clean, repo-compliant commits.
- `pull`: merge the latest `origin/main` into the current branch before implementation and before handoff.
- `push`: publish the branch, create or update the PR, and keep PR metadata current.
- `land`: when the issue reaches `Merging`, use this to shepherd the PR to merge.

## Status map

- `Backlog` -> out of scope; do not modify.
- `Todo` -> move immediately to `In Progress` before active work.
- `In Progress` -> active implementation.
- `Human Review` -> wait for human review and poll for feedback.
- `Merging` -> run the `land` skill; do not call `gh pr merge` directly outside that flow.
- `Rework` -> start a new implementation attempt from `origin/main`.
- `Done` -> terminal; do nothing.

## Branch rules

- Never work directly on `main`.
- Default base branch is `main` unless the issue or existing PR clearly says otherwise.
- If the current branch is `main`, create a new branch before editing.
- Prefer Linear's `branchName` when available. Otherwise create a branch named `type/description` using one of: `feature`, `fix`, `refactor`, `docs`, `chore`, `test`.

## Step 0: Determine current state

1. Fetch the Linear issue and read its current state.
2. Route by state:
   - `Backlog` -> stop.
   - `Todo` -> move to `In Progress`, then create or reuse the workpad comment.
   - `In Progress` -> continue using the existing workpad comment.
   - `Human Review` -> do not code; poll for PR feedback and wait.
   - `Merging` -> use the `land` skill.
   - `Rework` -> close prior PR if needed, remove the old workpad comment, create a fresh branch from `origin/main`, and restart.
   - `Done` -> stop.
3. Check whether a PR already exists for the current branch and whether it is open.
4. If the branch PR is closed or merged, do not reuse the branch. Start a fresh branch from `origin/main`.

## Step 1: Create or refresh the workpad

Use a single persistent Linear comment with this heading:

```md
## Codex Workpad
```

Rules:

- Reuse the existing unresolved workpad comment if one exists.
- Keep all progress, validation notes, and handoff details in that single comment.
- Do not create separate completion comments.

Required workpad structure:

````md
## Codex Workpad

```text
<hostname>:<abs-path>@<short-sha>
```

### Plan

- [ ] 1\. Parent task
  - [ ] 1.1 Child task
- [ ] 2\. Parent task

### Acceptance Criteria

- [ ] Criterion 1

### Validation

- [ ] targeted check: `<command>`
- [ ] repo gate: `pnpm lint`
- [ ] repo gate: `pnpm typecheck`
- [ ] repo gate: `pnpm test`

### Notes

- <timestamped progress note>

### Confusions

- <only include when something was unclear>
````

## Step 2: Plan and reproduce before coding

1. Reconcile the workpad before new implementation:
   - Check off already-complete items.
   - Refresh the plan, acceptance criteria, and validation list.
2. Reproduce the problem or capture the current baseline before editing code.
3. Record the reproduction signal in the workpad `Notes`.
4. Run the `pull` skill before editing and record:
   - merge source,
   - result (`clean` or `conflicts resolved`),
   - resulting `HEAD` short SHA.

## Step 3: Execute

1. Keep the workpad current as implementation progresses.
2. Use targeted validation during iteration, then run the full repo gate before push or handoff.
3. If you touch UI or user-facing behavior, add a concrete walkthrough acceptance criterion.
4. If you add or change user-facing copy:
   - use Lingui macros,
   - run `pnpm lingui:extract`,
   - update the workpad to show that it was done.
5. If the change is user-facing, add a changeset before handoff.
6. Never leave completed work unchecked in the workpad.

## PR feedback sweep protocol

When the issue has an attached PR:

1. Read top-level PR comments, inline review comments, and review summaries.
2. Treat only actionable comments and reviews from the configured reviewer
   login(s) plus bot feedback as blocking until either:
   - code/docs/tests were updated, or
   - a justified pushback reply was posted.
3. Reflect each feedback item in the workpad plan or notes.
4. Re-run validation after feedback-driven changes.
5. Repeat until no actionable comments remain.

## Step 4: Publish and hand off

1. Before every push:
   - run `pnpm lingui:extract`,
   - run the required validation gate,
   - confirm any needed changeset exists.
2. Use the `push` skill to publish the branch and create or update the PR.
3. Ensure the PR body is filled from `.github/PULL_REQUEST_TEMPLATE.md`.
4. Ensure the PR has the `symphony` label.
5. Merge `origin/main` again before moving to `Human Review`, rerun checks, and update the workpad with final validation results.
6. Only then move the issue to `Human Review`.

## Human Review and merge handling

1. In `Human Review`, do not code unless review feedback from the configured
   reviewer login(s) requires rework.
2. If feedback requires changes, move the issue to `Rework` and restart from a fresh branch.
3. In `Merging`, run the `land` skill until the PR is merged.
4. After merge completes, move the issue to `Done`.

## Guardrails

- Do not edit the Linear issue description for planning or progress tracking.
- Use exactly one persistent workpad comment per issue.
- Do not push directly to `main`.
- Do not force-push unless it is the safest required way to update a rewritten branch, and use `--force-with-lease` only.
- Every comment or reply posted by the agent on a GitHub pull request must
  start with this exact disclaimer, followed by a blank line:
  `🤖 **This is an Agent Response**`
- Keep comments concise and reviewer-oriented.
- If blocked by missing required auth, permissions, or secrets, record the blocker in the workpad and stop.
