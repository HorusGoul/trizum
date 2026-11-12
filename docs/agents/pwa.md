# PWA conventions

Read this when changing application UI or client state. Start with the
[PWA README](../../packages/pwa/README.md) for the package map and generated-file
commands.

## React and state

- Prefer React patterns over non-React alternatives.
- Do not add `useMemo`, `memo`, or `useCallback` by default.
- Use Automerge for persisted or shared collaborative state; use normal React
  state for local UI state.

## Sheets and Back navigation

Use `ModalSheet` from `@trizum/ui/ModalSheet` for local modal sheets, with
controlled `isOpen` and `onOpenChange`. The app's `PwaUIProvider` connects these
automatically to [sheet navigation](../../packages/pwa/src/lib/sheetNavigation.ts).
Browser and Android Back dismiss the top open sheet before changing routes;
`isDismissable={false}` consumes Back while the sheet is locked. Normal close
and unmount release registration. At the first app entry, where browser Back
would leave the document, the adapter uses a temporary same-URL guard and consumes
it on close; it adds no residual Back step. SPA entries use the router blocker.
Keep feature
state and discard/accept behavior in the sheet's existing callbacks.

Sheets already represented by route/search state, such as the calculator,
keep their route-driven navigation. Avoid per-feature `popstate` listeners or
manual browser history entries for shared modal sheets.

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
