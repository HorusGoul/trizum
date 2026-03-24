# Logging Policy

This document defines the repo-wide logging policy for `trizum`.

Use this doc for high-level guidance such as:

- what is worth logging,
- which severity level to use,
- what must never be logged,
- when logs should also reach Sentry,
- and how logging responsibilities are split across runtime surfaces and shared
  code.

Use [`packages/logging/README.md`](../packages/logging/README.md) for the
shared LogTape implementation details.

## Goals

Our logs should help us:

- understand normal application and infrastructure behavior,
- diagnose failures without reproducing them locally every time,
- detect unexpected but recoverable states before they become outages,
- and preserve user trust by avoiding sensitive data in logs.

Logs are for operational visibility, not for replacing tests or encoding
business logic.

## What To Log

Prefer logging at boundaries and important transitions:

- application startup and shutdown,
- request or job lifecycle events when they materially help debugging,
- external integration failures and fallbacks,
- unexpected states that should be visible but are not fatal,
- and user-impacting failures or broken invariants.

Useful logs usually include:

- a stable, human-readable message,
- structured context needed to understand the event,
- and enough identifiers to correlate related events without exposing secrets.

## What Not To Log

Do not log:

- passwords, tokens, API keys, session identifiers, cookies, or auth headers,
- Automerge document IDs or other shareable document identifiers; treat them as
  secrets,
- raw personal data unless there is an explicit, reviewed need,
- large payload dumps by default,
- high-frequency UI or render noise,
- or temporary debugging chatter that is not meant to survive the PR.

When in doubt, log less raw data and more structured identifiers.

## Severity Levels

### `debug`

Use for local diagnostics and high-volume implementation detail that is useful
while investigating behavior.

Examples:

- step-by-step dev helpers,
- low-level state transitions,
- and verbose tooling output.

Do not rely on `debug` logs being enabled in production.

### `info`

Use for important expected behavior and lifecycle milestones.

Examples:

- app or server startup,
- request start and completion when that is part of the operational picture,
- and successful execution of meaningful background or tooling steps.

`info` should be useful in normal operations without becoming noisy.

### `warning`

Use for unexpected but recoverable behavior.

Examples:

- fallback paths,
- partial failures,
- missing optional data,
- and states that may indicate a bug but do not stop the current flow.

Warnings should be actionable or at least worth noticing.

### `error`

Use for failed operations, broken invariants, and user-impacting or
request-impacting failures.

Examples:

- failed writes,
- request handlers returning error responses due to internal failures,
- failed imports or uploads,
- and exceptions that should be investigated.

If an error should also be visible in monitoring, make sure the application
configuration routes it to Sentry as well.

## Structured Context

Prefer structured properties over packing everything into the message string.

Good structured context often includes:

- version or release identifiers,
- request IDs,
- party or expense IDs when relevant,
- operation names,
- and environment or runtime details that explain behavior.

Avoid attaching objects wholesale unless they are already safe and small.
Do not attach Automerge document IDs as structured context.

## Sentry

Sentry is for errors and high-value operational signals, not for replacing the
normal console sink.

Runtime entry points may configure extra sinks, including Sentry, based on
their runtime needs. Shared libraries and reusable modules should not configure
Sentry on import.

In general:

- `error` logs are the main candidates for Sentry,
- `warning` logs may go to Sentry only when they represent a serious operational
  risk,
- and `debug` or routine `info` logs should stay out of Sentry.

## Ownership And Configuration

`trizum` uses LogTape as the standard logging library across the monorepo.

Follow these rules:

- runtime entry points configure LogTape,
- shared packages and reusable modules only ask for scoped loggers,
- use the shared helpers from [`@trizum/logging`](../packages/logging),
- and do not use raw `console.*` in normal repo code.

The shared category convention is:

- `["trizum", surface, ...scope]`

This keeps log streams consistent across server, PWA, mobile, screenshots, and
future packages.

## Review Checklist

When adding or reviewing logs, check:

- Is this event worth logging at all?
- Is the severity level appropriate?
- Is the message stable and understandable?
- Is the context structured and minimal?
- Could this leak secrets or sensitive user data?
- Does this belong in Sentry, console output, or both?
