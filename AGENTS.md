# trizum

trizum is an offline-first bill-splitting app backed by Automerge, with a PWA,
mobile wrappers, and a sync server.

Use **pnpm through Vite+ (`vp`)**; run `vp install` before starting work and after
pulling remote changes. From the workspace root, use `vp run check` for formatting,
linting, and type checks, `vp run test` for tests, and `vp run build` for builds.
Use `vp run dev` and `vp run preview` for the PWA.

Read only the guidance relevant to the task:

- **Before editing or performing Git/PR operations:** [Git workflow](./docs/agents/git-workflow.md).
- **Changing code:** [Coding conventions](./docs/agents/coding.md), the affected
  package's README, and any deeper `AGENTS.md` files.
- **Changing application UI or client state:** [PWA conventions](./docs/agents/pwa.md).
- **Validating changes or preparing a release/PR:** [Validation and releases](./docs/agents/validation-and-releases.md).
- **Setting up or troubleshooting tooling:** [Toolchain setup](./docs/agents/toolchain.md).
- **Finding package docs or maintaining agent guidance:** [Agent knowledge map](./docs/agent-knowledge-map.md).
- **Writing refactor plans:** [Refactor document protocol](./docs/refactor-docs.md).

Use relevant project-local [skills](./.agents/skills) for their named workflows.
