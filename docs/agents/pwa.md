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

## Motion and interaction design

Use [emilkowalski/skills](https://github.com/emilkowalski/skills) as the single
source for visual-design and animation skills installed in this repository.
Do not install competing visual-design or motion-guidance skills from other
sources. Use the project-local copies in `.agents/skills`.

Keep engineering and library-specific skills, such as React composition,
React performance, and React Aria accessibility, for their technical scope.
Repository coding, accessibility, and validation requirements still apply.

Choose the skill for the task:

- `gestures`: dragging, resistance, velocity, and interruptible releases.
- `animate`: purpose, timing, easing, and reduced-motion variants.
- `animation-performance`: first-open jank, frame budgets, paint, and compositing.
- `mobile-native`: touch behavior, hit targets, and mobile interaction details.
- `choreograph`: coordinating multiple animated elements.
- `emil-design-eng`, `apple-design`, and `review-animations`: broader design
  decisions and motion review. These installed skills also come from Emil's repo.
