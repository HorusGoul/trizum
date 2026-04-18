# Agent Knowledge Map

This document defines the smallest useful map of agent-facing knowledge in the
`trizum` repo. The goal is to keep agent context easy to find, hard to stale,
and owned close to the code it describes.

## Principles

- Executable metadata beats prose. Tool versions and runnable commands belong in
  [`.nvmrc`](../.nvmrc) and [`package.json`](../package.json), not in narrative
  docs.
- The root guide should route, not explain everything. Package and domain docs
  should hold the details that change with the code.
- Narrow docs beat monoliths. If a rule only matters for one package or one
  workflow, keep it there.
- Placeholder docs are noise. A package doc should either describe the package
  accurately or not exist.

## Canonical Surfaces

| Surface                                                                | Canonical for                                                                   | Owner                   | Freshness expectation                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| [`/AGENTS.md`](../AGENTS.md)                                           | Repo entry point, repo-wide workflow, and routing to deeper sources             | Repo maintainer         | Update in the same PR when repo-wide workflow, package entry points, or routing changes |
| [`/docs/agent-knowledge-map.md`](./agent-knowledge-map.md)             | Source-of-truth map for agent-facing surfaces and ownership model               | Repo maintainer         | Update in the same PR when a surface is added, removed, or re-scoped                    |
| [`/docs/logging.md`](./logging.md)                                     | Repo-wide logging policy, severity guidance, and redaction expectations         | Repo maintainer         | Update in the same PR as repo-wide logging policy or observability expectations change  |
| [`/docs/package-authoring.md`](./package-authoring.md)                 | Standard workflow and defaults for authoring new workspace packages             | Repo maintainer         | Update in the same PR as new-package conventions or template defaults change            |
| [`/.nvmrc`](../.nvmrc) and [`/package.json`](../package.json)          | Node version, package manager version, and workspace-level commands             | Workspace maintainer    | Update in the same PR as toolchain or root script changes                               |
| [`/packages/*/package.json`](../packages)                              | Package-local scripts and executable package metadata                           | Package maintainer      | Update in the same PR as script or runtime changes                                      |
| [`/packages/pwa/README.md`](../packages/pwa/README.md)                 | Main app package map, PWA-specific validation, and where common app work lives  | PWA maintainer          | Update in the same PR as package structure or workflow changes                          |
| [`/packages/pwa/e2e/README.md`](../packages/pwa/e2e/README.md)         | Browser journey harness strategy, seeded-state conventions, and E2E setup seams | PWA maintainer          | Update in the same PR as the Playwright harness shape or setup strategy changes         |
| [`/packages/pwa/locale/AGENTS.md`](../packages/pwa/locale/AGENTS.md)   | Translation terminology and locale-specific guardrails                          | Localization maintainer | Update in the same PR as translation rules or product terminology changes               |
| [`/packages/mobile/README.md`](../packages/mobile/README.md)           | Native wrapper workflow and package-specific operational details                | Mobile maintainer       | Update in the same PR as mobile setup or release workflow changes                       |
| [`/packages/server/README.md`](../packages/server/README.md)           | Sync server architecture, runbook entry points, and package-specific validation | Server maintainer       | Update in the same PR as server structure, run flow, or deployment assumptions change   |
| [`/packages/screenshots/README.md`](../packages/screenshots/README.md) | Store-screenshot workflow and Fastlane handoff details                          | Release maintainer      | Update in the same PR as screenshot capture or organization flow changes                |
| [`/.agents/skills/*/SKILL.md`](../.agents/skills)                      | Named, reusable workflows with tool-specific procedures                         | Skill owner             | Update in the same PR as the workflow, tools, or assumptions change                     |

Until the repo has formal code ownership, the maintainer who changes one of
these surfaces in a PR is responsible for keeping its adjacent agent-facing docs
current.

## What Belongs Where

### Root `AGENTS.md`

Keep only:

- repo purpose and major package layout,
- repo-wide workflow rules,
- the short list of canonical deeper entry points,
- stable guardrails that apply across most work.

Do not keep:

- duplicated Node or pnpm versions,
- long package-specific setup instructions,
- task-specific command recipes that already live in a skill,
- placeholder package descriptions copied from templates.

### Package READMEs

Use package docs for:

- when that package matters,
- the main directories or files to inspect first,
- package-specific validation commands,
- generated-file warnings or package-local traps.

Do not use package docs for:

- repo-wide branching or PR policy,
- global tool versions,
- deep workflow scripts that are better expressed as a skill.

### Subdirectory `AGENTS.md`

Create or keep these only for domain-specific rules that are easy to forget and
hard to infer from code. The existing locale guide is the model to copy:
specific, scoped, and durable.

### Skills

Move repeated, named workflows into skills when the procedure is stable but
still human-invoked. Skills are the right place for tool usage patterns such as
browser automation, PR push flow, changeset creation, or generated-file
regeneration.

### Scripts and CI

If a rule can be enforced mechanically, prefer a script, generated file, or CI
check. Docs should explain the rule, not be the only place it lives.

### Cross-Cutting Repo Policies

Use `docs/*.md` for stable, repo-wide policies that cut across multiple
packages but do not belong in the root routing guide. The logging policy in
[`/docs/logging.md`](./logging.md) is the model for this kind of document.

## Default Read Path

For most coding tasks, an agent should read in this order:

1. [`/AGENTS.md`](../AGENTS.md)
2. this file
3. the package README for the area being changed
4. any deeper subdirectory `AGENTS.md` for that domain
5. the relevant skill, if the task matches one
6. the package's `package.json` for the exact runnable commands

The screenshots package is intentionally not part of the default path for normal
app or server work. It is a specialist package and should say so explicitly.

## When A Rule Graduates To Automation

Use this progression:

1. Keep a rule in documentation when the policy is still changing or the work
   needs meaningful human judgment.
2. Promote the rule to a skill when the same ordered steps show up across about
   three or more tasks or PRs, the trigger is easy for a human to recognize,
   and the workflow benefits from a shared playbook.
3. Promote the rule from documentation or skill into automation when:
   - the trigger is objective,
   - inputs can be discovered from repo or task state,
   - the steps are deterministic,
   - success or failure can be verified mechanically,
   - and the failure mode is safe to surface without hidden judgment.

Examples in this repo:

- Toolchain versions belong in [`.nvmrc`](../.nvmrc) and
  [`package.json`](../package.json), not in `AGENTS.md`.
- Changeset creation belongs in
  [`.agents/skills/creating-changesets/SKILL.md`](../.agents/skills/creating-changesets/SKILL.md)
  because the trigger is repo-wide and the workflow is ordered, repeatable, and
  a good fit for agent execution.
- Icon sprite regeneration belongs in a skill because it is repeatable and
  human-invoked.
- Validation that can be enforced in CI should eventually stop relying on prose
  reminders alone.
