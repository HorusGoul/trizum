---
name: land
description:
  Queue a PR for merging by commenting @mergifyio queue; use when asked to
  land, merge, or queue a PR for merging.
---

# Land

Follow the repo's [Git workflow](../../../docs/agents/git-workflow.md).
Mergify handles CI gates, review requirements, branch updates, and squash
merging according to [`.mergify.yml`](../../../.mergify.yml).

1. Identify the requested PR, or find the current branch's PR with `gh pr view`.
2. Monitor CI, reviews, and changes to the PR head before queueing. Address
   feedback and failures, resolve conflicts, and push any fixes. A new head
   needs fresh checks and review. Reply to review feedback with `[codex]`.
   Use the host's PR watcher while waiting. Where no host watcher is available,
   run `python3 .agents/skills/land/land_watch.py` from the PR branch. It exits
   with 0 when checks pass and feedback is addressed, 2 for review feedback,
   3 for failed/missing checks, 4 for a new head, or 5 for conflicts.
3. Once the current head has passing CI and no outstanding feedback, post a
   comment containing exactly `@mergifyio queue`:

   ```sh
   gh pr comment <number-or-url> --body '@mergifyio queue'
   ```

   Do not prepend `[codex]` or add surrounding prose. Do not merge directly
   with `gh pr merge` or enable GitHub auto-merge.
4. Check Mergify's response and report the PR link and queue state. If the
   request is pending or rejected, report the reason; do not bypass the queue.
   Report the PR as merged only when GitHub confirms it.

Queueing is the handoff to Mergify. Monitor until merge only when requested,
using the host's PR watcher when available.

## Checks and Head Changes

- Inspect failures with `gh pr checks` and `gh run view --log`. Fix and validate
  locally, then use the `commit` and `push` skills before checking again.
- Use the `pull` skill to merge main and resolve conflicts. If mergeability is
  `UNKNOWN`, wait for GitHub to compute it before queueing.
- If CI adds an autofix commit, fetch and integrate the new head, then check its
  CI and reviews again. Do not force-push merely to retry CI.
- Treat a clean watcher result as a snapshot: confirm the head has not changed
  and check for new feedback immediately before posting the queue comment.
- Codex review jobs are non-blocking. Read their review comments rather than
  treating a green job as proof that there are no findings.
- A failed `Mergify Merge Queue` check describes the previous queue attempt,
  not prerequisite CI; the fallback watcher excludes that check. Inspect why
  the PR was dequeued and resolve the cause before reissuing `@mergifyio queue`.
  The command resets the queue status; other failed checks still block queueing.

## Review Handling

- Before implementing feedback, check it against the user's intent and task
  context. If it conflicts or needs clarification, explain the issue in the
  review thread and ask before changing code.
- For each comment, accept, clarify, or push back. When disagreeing, acknowledge
  the feedback, explain the rationale, and offer an alternative.
- Codex reviews now arrive as issue comments posted by GitHub Actions. They
  start with `## Codex Review — <persona>` and include the reviewer’s
  methodology + guardrails used. Treat these as feedback that must be
  acknowledged before merge.
- Human review comments are blocking and must be addressed (responded to and
  resolved) before requesting a new review or merging.
- Informational service-bot comments are non-blocking unless they request a
  real code/docs/test change. Do not reply just to clear changeset-bot or
  deploy status comments.
- If multiple reviewers comment in the same thread, respond to each comment
  (batching is fine) before closing the thread.
- Fetch review comments via `gh api` and reply with a prefixed comment.
- Use review comment endpoints (not issue comments) to find inline feedback:
  - List PR review comments:
    ```
    gh api repos/{owner}/{repo}/pulls/<pr_number>/comments
    ```
  - PR issue comments (top-level discussion):
    ```
    gh api repos/{owner}/{repo}/issues/<pr_number>/comments
    ```
  - Reply to a specific review comment:
    ```
    gh api -X POST /repos/{owner}/{repo}/pulls/<pr_number>/comments \
      -f body='[codex] <response>' -F in_reply_to=<comment_id>
    ```
- `in_reply_to` must be the numeric review comment id (e.g., `2710521800`), not
  the GraphQL node id (e.g., `PRRC_...`), and the endpoint must include the PR
  number (`/pulls/<pr_number>/comments`).
- If GraphQL review reply mutation is forbidden, use REST.
- A 404 on reply typically means the wrong endpoint (missing PR number) or
  insufficient scope; verify by listing comments first.
- Prefix explanatory GitHub comments with `[codex]`. Post the Mergify queue
  command without that prefix so Mergify can recognize it.
- For Codex review issue comments, reply in the issue thread (not a review
  thread) with `[codex]` and state whether you will address the feedback now or
  defer it (include rationale).
- If feedback requires changes:
  - For inline review comments (human), reply with intended fixes
    (`[codex] ...`) **as an inline reply to the original review comment** using
    the review comment endpoint and `in_reply_to` (do not use issue comments for
    this).
  - Implement fixes, commit, push.
  - Reply with the fix details and commit sha (`[codex] ...`) in the same place
    you acknowledged the feedback (issue comment for Codex reviews, inline reply
    for review comments).
  - The land watcher treats Codex review issue comments as unresolved until a
    newer `[codex]` issue comment is posted acknowledging the findings.
- Only request a new Codex review when you need a rerun (e.g., after new
  commits). Do not request one without changes since the last review.
  - Before requesting a new Codex review, inspect current feedback and ensure
    there are zero outstanding review comments (all have `[codex]` inline
    replies).
  - After pushing new commits, the Codex review workflow will rerun on PR
    synchronization (or you can re-run the workflow manually). Post a concise
    root-level summary comment so reviewers have the latest delta:
    ```
    [codex] Changes since last review:
    - <short bullets of deltas>
    Commits: <sha>, <sha>
    Tests: <commands run>
    ```
  - Only request a new review if there is at least one new commit since the
    previous request.
  - Wait for the next Codex review comment before merging.

## Scope + PR Metadata

- The PR title and description should reflect the full scope of the change, not
  just the most recent fix.
- If review feedback expands scope, decide whether to include it now or defer
  it. You can accept, defer, or decline feedback. If deferring or declining,
  call it out in the root-level `[codex]` update with a brief reason (e.g.,
  out-of-scope, conflicts with intent, unnecessary).
- Correctness issues raised in review comments should be addressed. If you plan
  to defer or decline a correctness concern, validate first and explain why the
  concern does not apply.
- Classify each review comment as one of: correctness, design, style,
  clarification, scope.
- For correctness feedback, provide concrete validation (test, log, or
  reasoning) before closing it.
- When accepting feedback, include a one-line rationale in the root-level
  update.
- When declining feedback, offer a brief alternative or follow-up trigger.
- Prefer a single consolidated "review addressed" root-level comment after a
  batch of fixes instead of many small updates.
- For doc feedback, confirm the doc change matches behavior (no doc-only edits
  to appease review).
