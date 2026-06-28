# Agent Workflows

`@trizum/agent-workflows` contains Barnum-based maintenance workflows for the
trizum repository.

The first workflow reviews Renovate PRs and creates superseding fix branches
with Sandcastle and Codex:

1. list open PRs and pick a Renovate PR,
2. inspect the diff, changed dependencies, usage sites, changelog sources, and
   check status,
3. ask Codex for a focused review in a disposable Sandcastle branch,
4. apply the `ready for human review` label when no blocking issue is found,
5. optionally create a superseding PR when the original Renovate PR has failing
   checks.

The workflow never merges PRs.

## Commands

From this package:

```sh
vp run renovate-pr-review -- --pr 123
vp run renovate-pr-review -- --pr 123 --write
vp run renovate-pr-review -- --pr 123 --supersede
```

From the workspace root:

```sh
vp run --filter @trizum/agent-workflows renovate-pr-review -- --pr 123
```

By default the workflow is a dry run. Use `--write` to create labels/comments.
Use `--supersede` to let the workflow create and push a replacement PR when
checks are failing.

## Codex And Sandcastle

Codex runs through `@ai-hero/sandcastle` for both review and superseding PR
fixes. Review runs use a disposable Sandcastle branch that is removed after the
run. Superseding fixes use the branch that becomes the replacement PR. The
workflow passes `--ignore-user-config` to `codex exec` so automation uses Codex
auth from `CODEX_HOME` without inheriting personal MCP, hook, or local config.

Use `--no-codex` or `--codex off` to run only the deterministic review.
Use `--codex required` to treat a failed Codex review as a blocker.

The Renovate GitHub Actions workflow uses Bitwarden Secrets Manager to restore
a copied Codex ChatGPT login cache at `~/.codex/auth.json` before Sandcastle
invokes Codex. After Codex runs, the workflow writes the refreshed auth cache
back to the same Bitwarden secret so token refreshes survive ephemeral runners.

Treat `auth.json` like a password. It contains Codex account tokens.

## Labels

The default ready label is:

```text
ready for human review
```

When running in write mode, the workflow ensures the label exists before adding
it. The label is applied to:

- the original Renovate PR when checks are not failing and no blocking review
  issues are found,
- superseding PRs created by the workflow.

## Validation

Routine package checks:

```sh
vp run check
vp run test
vp run build
```
