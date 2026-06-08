# Changeset Scenarios & Examples

## Bug Fix

```markdown
---
"@trizum/pwa": patch
---

Fix duplicate expense save submissions

Rapidly tapping save on an expense editor now creates a single expense instead
of submitting duplicate writes.
```

## New Feature

```markdown
---
"@trizum/pwa": minor
---

Add settlement summary sharing

Parties can now share a summary of current balances:
- Includes the current settlement plan
- Uses existing party share affordances
- Keeps generated copy localized through Lingui
```

## Breaking Change

```markdown
---
"@trizum/pwa": major
---

Change invite payload format

**BREAKING**: Party invites now encode the Automerge document URL and display
metadata in a versioned payload.

Before:
```json
{
  "partyId": "..."
}
```

After:
```json
{
  "version": 2,
  "documentUrl": "...",
  "name": "Trip"
}
```

Migration: Regenerate active party invite links after upgrading.
```

## Multiple Related Changes

```markdown
---
"@trizum/server": minor
---

Improve sync server observability

- Add structured logs for sync sessions
- Report health check latency
- Include deployment commit metadata in startup logs
```

## PWA Accessibility Improvements

```markdown
---
"@trizum/pwa": patch
---

Improve accessibility labels for expense actions

- Adds accessible labels to icon-only expense action buttons
- Improves screen reader names for share and delete controls
- Keeps visual styling unchanged
```

## Consolidated Changeset Example

When multiple changesets should be combined before release:

```markdown
---
"@trizum/pwa": minor
---

Multiple improvements to party sharing

This release includes several related improvements:

- Add QR code invite sharing (#123)
- Improve copied invite message text (#124)
- Add validation for expired invites (#125)
```

## Writing Good Descriptions

### Do's

```markdown
---
"@trizum/pwa": minor
---

Add recurring expense templates

Parties can now create reusable expense templates:
- Supports common payer and split combinations
- Validates template data before saving
- Reuses the existing expense editor flow
```

### Don'ts

```markdown
---
"@trizum/pwa": patch
---

fix bug
```

### Best Practices

1. **Start with a verb**: Add, Fix, Update, Remove, Improve
2. **Be specific**: What changed and why
3. **Include context**: Reference issue numbers if applicable
4. **Document migration**: For breaking changes

## Analyzing Changes for Bump Type

### Check git diff

```bash
# See what changed since last release
git log --oneline main..HEAD

# See detailed changes
git diff main..HEAD -- src/
```

### Key Questions

1. **Did the public API change?**
   - CLI commands modified → minor/major
   - Configuration schema changed → patch/minor/major
   - New features added → minor

2. **Could this break existing users?**
   - Yes, requires code changes → major
   - Yes, but has fallback → minor
   - No → patch

3. **Is this user-facing?**
   - Yes, new capability → minor
   - Yes, improved existing → patch
   - No, internal only → patch

## Consolidating Changesets

```bash
# View pending changesets
ls .changeset/

# Manually consolidate by:
# 1. Reading all changeset files
# 2. Creating a single comprehensive changeset
# 3. Deleting the individual files
```

## Pre-Release Versions

For beta/alpha releases:

```bash
# Enter pre-release mode
vp exec changeset pre enter beta

# Create changesets as normal
vp exec changeset

# Exit pre-release mode
vp exec changeset pre exit
```
