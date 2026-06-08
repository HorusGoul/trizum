---
name: creating-changesets
description: "Creates changesets for semantic versioning. Use when adding changesets, preparing releases, determining version bumps (patch/minor/major), generating changelog entries, or documenting breaking changes."
allowed-tools: "Read, Grep, Glob, Write, Edit, Bash(git:*), Bash(gh auth token), Bash(vp exec changeset:*)"
metadata:
  author: Ollie Shop
  version: 1.0.0
compatibility: "Claude Code or Codex with Vite+, Node.js 24+, TypeScript 5.9+"
---

# Changeset & Release Manager

## Overview

Automate the creation of changesets following project conventions, ensuring proper version bumps and well-documented release notes.

## When to Use

- After completing a feature or fix
- Before creating a PR
- When preparing a release
- To document breaking changes

## What is a Changeset?

A changeset is a markdown file in the `.changeset/` directory that describes:
1. Which packages are affected
2. What type of version bump (patch/minor/major)
3. A description of the change

## Changeset Types

| Type | When to Use | Version Change |
|------|-------------|----------------|
| `patch` | Bug fixes, documentation, refactoring, dependency updates | 1.0.0 → 1.0.1 |
| `minor` | New features, non-breaking enhancements | 1.0.0 → 1.1.0 |
| `major` | Breaking changes, API modifications | 1.0.0 → 2.0.0 |

## Decision Guide

### Use `patch` for:
- Bug fixes that don't change behavior
- Documentation updates
- Internal refactoring (no API changes)
- Dependency updates (non-breaking)
- Performance improvements
- Code style/linting fixes

### Use `minor` for:
- New features
- New CLI commands
- New configuration options
- Enhanced functionality
- New entity types support
- Non-breaking API additions

### Use `major` for:
- Breaking configuration changes
- Removed features or commands
- Changed CLI interface
- Required migration steps
- Node.js version requirement changes

## Creating a Changeset

### Interactive Method

```bash
vp exec changeset
```

Follow the prompts:
1. Select affected packages (space to select)
2. Choose bump type for each package
3. Write a summary of changes

### Manual Method

Create a file in `.changeset/` with a random name:

```markdown
---
"@trizum/pwa": minor
---

Add party invite QR code sharing

- Adds an in-app QR share flow for party invites
- Keeps generated share links compatible with existing invite URLs
- Includes validation for malformed invite payloads
```

### Issue Closing References

When a change fixes a GitHub issue, include the exact closing reference in the
changeset body:

```markdown
Fixes #123.
```

Put closing keywords such as `Fixes`, `Closes`, or `Resolves` in the changeset,
not in the PR title or body. PRs should link related issues with non-closing
phrasing such as `Related to #123` so the issue remains open until the generated
Version Packages PR is merged.

### File Format

```markdown
---
"package-name": patch|minor|major
---

Short description of the change (shown in CHANGELOG)

Optional longer description with:
- Bullet points for details
- Code examples if needed
- Migration instructions for breaking changes
- `Fixes #ISSUE` when the changeset fixes a GitHub issue
```

## Release Workflow

### 1. Create Changeset

```bash
vp exec changeset
git add .changeset/
git commit -m "chore: add changeset for feature"
```

### 2. PR and Review

- Changeset is part of the PR
- Reviewers can suggest bump type changes

### 3. Merge to Main

- Changesets action creates "Version Packages" PR
- This PR updates version and CHANGELOG
- Issue-closing references from changeset bodies are carried into this PR

### 4. Merge Version PR

- Triggers npm publish
- Creates GitHub release
- Closes fixed GitHub issues referenced with `Fixes #ISSUE`

## Checking Status

```bash
# See what changesets exist
vp exec changeset status

# Preview version bump with GitHub contributor metadata
GITHUB_TOKEN=$(gh auth token) vp exec changeset version --dry-run
```

## Common Mistakes

| Mistake | Issue | Fix |
|---------|-------|-----|
| Wrong bump type | Unexpected version | Review decision guide above |
| Vague description | Poor CHANGELOG | Be specific about changes |
| Missing changeset | No release notes | Always add before PR |
| Multiple changesets | Fragmented notes | Combine related changes |
| Not including context | Hard to understand | Explain *why* not just *what* |

## Common Scenarios

For detailed examples of common scenarios including:
- Bug fixes, new features, breaking changes
- Multiple related changes
- Consolidated changesets
- Pre-release versions
- Best practices for descriptions

See **[Scenarios & Examples](references/scenarios.md)**

## References

- `{baseDir}/.changeset/config.json` - Changeset configuration
- `{baseDir}/CHANGELOG.md` - Generated changelog
- Changesets docs: https://github.com/changesets/changesets

## Related Skills

- **CI/CD automation**: See `managing-github-ci` for release workflow integration
- **Pre-commit validation**: See `validating-pre-commit` for quality gates before committing
