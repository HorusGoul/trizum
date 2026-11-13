# Coding conventions

Read this before changing code in any package, together with that package's
README and any deeper `AGENTS.md` files.

- TypeScript is required for all code.
- Expense calculations and other critical business logic need tests.
- Do not edit generated files manually. Package READMEs identify generated
  outputs and their regeneration commands.

For React UI, localization, styling, or client state, read the
[PWA conventions](./pwa.md).

## Automerge persistence tests

Changes to persisted Automerge document models or read/edit/write paths require
a test that starts from a real document, exercises the production edit and
serialization path, and writes the result back through Automerge. Include
existing save paths that carry a new nested field unchanged. Follow the
[automerge-testing skill](../../.agents/skills/automerge-testing/SKILL.md)
for case selection, ownership pitfalls, and existing test examples.
