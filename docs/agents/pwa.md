# PWA conventions

Read this when changing application UI or client state. Start with the
[PWA README](../../packages/pwa/README.md) for the package map and generated-file
commands.

## React and state

- Prefer React patterns over non-React alternatives.
- Do not add `useMemo`, `memo`, or `useCallback` by default.
- Use Automerge for persisted or shared collaborative state; use normal React
  state for local UI state.

## Copy and appearance

- User-facing strings must use Lingui. Run `vp run lingui:extract` from the
  workspace root when user-facing copy changes.
- Follow the [locale guide](../../packages/pwa/locale/AGENTS.md) when changing
  translations.
- Use the `accent` color scale and explicit `dark:` variants in the PWA.
