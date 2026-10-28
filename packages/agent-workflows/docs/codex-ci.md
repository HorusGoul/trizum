# Codex review runtime and CI authentication

[Back to package overview](../README.md). Read when configuring the review runtime or renewing CI authentication.

## Codex And Sandcastle

Codex runs through `@ai-hero/sandcastle` for both review and superseding PR
fixes. Review runs use a disposable Sandcastle branch that is removed after the
run. Superseding fixes use the branch that becomes the replacement PR. The
workflow passes `--ignore-user-config` to `codex exec` so automation uses Codex
auth from `CODEX_HOME` without inheriting personal MCP, hook, or local config.
By default, Codex uses `gpt-5.6-sol` with `high` reasoning effort. Set
`TRIZUM_AGENT_WORKFLOWS_CODEX_MODEL` or
`TRIZUM_AGENT_WORKFLOWS_CODEX_EFFORT` to override either setting.

Use `--no-codex` or `--codex off` to run only the deterministic review.
Use `--codex required` to treat a failed Codex review as a blocker.

The Renovate GitHub Actions workflow uses Bitwarden Secrets Manager to restore
a copied Codex ChatGPT login cache under the runner's temporary `CODEX_HOME`
before Sandcastle invokes Codex. All reviews sharing the secret run serially,
without cancelling active runs. Any other workflow using that secret must use
the same `codex-auth-${{ vars.BITWARDEN_CODEX_AUTH_JSON_SECRET_ID }}` concurrency
group. The queue holds up to 100 pending runs.

After Codex runs, even if the review fails or reaches its step timeout, the
workflow saves changed, structurally valid credentials back to Bitwarden. It
retries failed writes three times and reserves time for saving before the job
timeout. Runner loss or forced termination can still prevent saving.

An unrecoverable Codex authentication error stops the review pipeline before
it can start a repair attempt. The error explains how to renew the CI login.

### Renew the CI login

From the workspace root, run:

```sh
vp run codex:auth
```

Complete the browser login. The command creates a separate session in a temporary
directory, validates the credential bundle, and copies the complete `auth.json`
to your clipboard. It removes the temporary directory afterward and leaves your
normal Codex login unchanged. Credentials are never printed.

When no agent review is running, paste into the **value** of the Bitwarden secret
referenced by the repository variable `BITWARDEN_CODEX_AUTH_JSON_SECRET_ID`.
Save the secret, then rerun the failed workflow. Updating it during a review
could let that review overwrite the new login with its previous session.

Clipboard support uses `pbcopy` on macOS, PowerShell on Windows, and `wl-copy`
(Wayland) or `xclip` (X11) on Linux. The project supplies the Codex CLI.

Treat `auth.json` like a password. It contains Codex account tokens.
