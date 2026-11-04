# React Doctor exception reproductions

Use these minimal sources when investigating or reporting the exceptions tracked
in [#508](https://github.com/HorusGoul/trizum/issues/508). They are scan inputs,
not application entry points. The `.fixture` suffix keeps intentionally reported
patterns out of application and workspace scans.

From the workspace root, after `vp install`, run:

```sh
vp exec node packages/pwa/reproductions/react-doctor/reproduce.ts > /tmp/trizum-react-doctor-reproductions.json
vp exec node packages/pwa/reproductions/react-doctor/reproduce.ts --oxlint > /tmp/trizum-oxlint-reproductions.json
vp exec node packages/pwa/reproductions/react-doctor/reproduce.ts --oxlint --pwa-config > /tmp/trizum-pwa-oxlint-reproductions.json
```

The runner copies the sources into a temporary Vite project, links the installed
dependencies, and invokes the repository's pinned React Doctor. It prints the
temporary directory to stderr and retains it for investigation. The `--oxlint`
mode runs the four relevant rules directly through Vite+'s Oxlint, with a
temporary reproduction-only config. That command intentionally exits nonzero
while the reported patterns still reproduce. Neither mode installs dependencies,
changes repository rule configuration, or submits upstream reports.

`--pwa-config` applies the shared PWA overrides to either runner. Both configured
runners report the same three remaining patterns. The CLI also recognizes this
Vite project's client-only boundary without those overrides.

With React Doctor and oxlint-plugin-react-doctor 0.9.18, React 19.3.1, and
Capacitor App 8.1.2, the complete five-file scan reports:

| Input                                 | Result                                                         | Expected behavior                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClientOnlyCalculator.tsx.fixture`    | No CLI diagnostics; two browser-global errors in direct Oxlint | The `createRoot` entry point does not hydrate or render on a server. The browser layout guard and `document.body` portal are valid here. The CLI gates these rules using project context; the generic plugin still reports both patterns. The shared PWA overrides in `../../../../doctor.config.ts` exclude these SSR-only rules in both runners; the two application exceptions are removed. |
| `InitialHash.tsx.fixture`             | `no-ref-current-in-render`                                     | The null-guarded initial baseline is written only during initialization; later updates happen in an event. [React permits predictable guarded initialization](https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents).                                                                                                                                                  |
| `AsyncUpdateListener.tsx.fixture`     | `effect-needs-cleanup`                                         | Cleanup chains removal onto the registration promise. It removes the exact handle even when registration completes after unmount.                                                                                                                                                                                                                                                              |
| `AsyncAdvertisingCleanup.tsx.fixture` | `effect-needs-cleanup`                                         | Cleanup cancels the frame, removes the promised listener, and starts coordinator destruction without waiting for registration.                                                                                                                                                                                                                                                                 |

The three remaining inline exceptions should be removed when the corresponding
unsuppressed application code passes both `vp run check` and React Doctor. Run
the application checks as well as these reproductions: a clean minimal example
alone does not establish that the production occurrence is fixed.

`src/components/NativeControllerCleanup.test.tsx` verifies the real controllers'
cleanup before and after listener registration and across Strict Mode replay.
The expense editor retains its initial baseline and dirty-state behavior.
The window-focus listener in `RealtimeExpenseEditorPresence` already has matching
cleanup and remains outside these exceptions.
