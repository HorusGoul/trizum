---
name: async-react
description: Build or refactor React UI around Async React action props, transitions, optimistic state, pending states, and React Aria design-system components. Use when adding async interactions, changing design-system component APIs, replacing manual loading state, or reviewing whether an interaction should use useTransition, useOptimistic, useActionState, form actions, or plain event handlers.
---

# Async React

Use Async React patterns when an interaction may trigger async work and the user
needs immediate, local feedback. Keep the async coordination as close as possible
to the design component that owns the interaction.

## Decision Flow

1. Keep plain event handlers for synchronous interaction details such as
   validation, event inspection, `preventDefault`, analytics, or local UI state
   that must happen immediately.
2. Add an action prop when the component is responsible for starting async work.
   Name it with the `Action` suffix or a concrete action noun, such as
   `pressAction`, `changeAction`, `selectionChangeAction`, or `menuAction`.
3. Run action props inside `startTransition` or a shared hook that uses
   `useTransition`, and `await` the action so pending state tracks sync and async
   implementations.
4. Use `useOptimistic` when the visible value is controlled by a parent prop but
   should update before the async work settles.
5. Let the design component own pending UI when possible. In React Aria wrappers,
   prefer RAC's `isPending` for buttons because it keeps the button focusable,
   suppresses duplicate presses, and announces pending state.
6. Use `useActionState` or form-library submission state when the interaction is
   fundamentally a form reducer/submission flow, especially when ordering or
   queued actions matter.

## Component API Pattern

Expose both a synchronous event prop and an action prop when both are useful:

```tsx
function Component({ value, onChange, changeAction }) {
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);
  const [isPending, startTransition] = useTransition();

  function handleChange(nextValue) {
    onChange?.(nextValue);
    startTransition(async () => {
      setOptimisticValue(nextValue);
      await changeAction?.(nextValue);
    });
  }

  return <Control value={optimisticValue} isPending={isPending} onChange={handleChange} />;
}
```

In this repo, prefer the shared PWA UI helper when it fits the interaction:

```tsx
const { isPending, runAction } = useActionProp({
  action: pressAction,
  onAction: onPress,
});
```

Use `runAction` for the underlying React Aria event prop, and pass `isPending`
into the component's visual and accessibility state.

## Optimistic State

Use optimistic state for visible values such as selected tabs, toggles,
checkboxes, selected options, editable text, or inline status. The optimistic
setter must run inside an Action. Do not call it in a normal event handler.

For controlled components, derive optimistic state from the controlled prop and
pass the optimistic value back into the underlying primitive. For uncontrolled
components, let the primitive keep its local state and use the action prop only
for pending feedback.

When the optimistic value needs formatting, accept a formatter function rather
than a static display node so consumers do not need access to internal
optimistic state.

## Pending UI

Keep pending feedback local to the interaction that started the work. Good
defaults are spinner icons for buttons and subtle pulse/disabled states for
toggles, tabs, and menu items.

Avoid broad manual `isLoading` state in route components when a design component
can own the transition. Keep external pending state only when it intentionally
coordinates multiple controls, prevents dismissing a modal, or disables fields
outside the originating component.

## Avoid

- Do not wrap text-input keystroke state in transitions; controlled text inputs
  need urgent updates.
- Do not add `useMemo`, `memo`, or `useCallback` just for action props.
- Do not hide already revealed content behind a route or page-level spinner when
  local pending feedback can cover the interaction.
- Do not swallow Action errors silently. Let errors reach an error boundary or
  handle them deliberately with existing product feedback such as toasts.
- Do not use action props for simple synchronous callbacks that have no async
  work, no Suspense risk, and no need for pending UI.

## Validation

For PWA changes, run `vp run --filter @trizum/pwa check` after refactoring. If
user-facing copy changes, run `vp run lingui:extract`.
