# trizum mobile UI tests

Device UI tests for the [native apps](../mobile/README.md). Commands run from
`packages/mobile-e2e`.

The same three journeys exist twice, so the two runners can be compared:

- [`e2e/`](./e2e) with [`e2e.config.ts`](./e2e.config.ts): TypeScript tests
  for [e2e](https://e2e.com/docs/mobile), driven by agent-device. They need no
  model or API key.
- [`.maestro/`](./.maestro): Maestro flows. Shared steps live in
  `.maestro/subflows/`.

Keep the two in step: a change to one journey changes both files.

## Prepare a device

Both runners drive the app that is already installed (`app.trizum.capacitor`)
and clear its data before each test.

- **iOS simulator:** build the `App` scheme for the simulator, then install the
  `.app` with `xcrun simctl install <udid> <path>`.
- **Android:** build with `./gradlew assembleDebug` in `packages/mobile/android/`, then
  `adb -s <serial> install -r <apk>`.

See [Mobile development](../mobile/docs/development.md) for the PWA build and Capacitor sync
that come first.

## Run the suites

```bash
E2E_IOS_DEVICE=<udid> vp exec e2e run --target ios
E2E_ANDROID_DEVICE=<serial> vp exec e2e run --target android
maestro --device <udid-or-serial> test .maestro
```

Without `E2E_IOS_DEVICE` or `E2E_ANDROID_DEVICE`, e2e uses a booted device.
e2e writes traces with the screen at each failure to `.e2e/results/`.

To test a build with another application id, for example a debug build with an
`applicationIdSuffix` installed beside the store app, set `E2E_APP_ID=<id>` for
e2e and pass `-e APP_ID=<id>` to Maestro.

A device can serve one driver session at a time: close other agent-device
sessions on it, such as an IDE device panel, before an e2e run.

## Compare the runners

```bash
node scripts/bench-ui-tests.ts --platform ios --device <udid> --runs 5
```

The script alternates which runner goes first in each round and writes
`bench-results/<platform>-<timestamp>/summary.md` with wall-clock and per-test
medians. Add `--app-id <id>` for a renamed build.

## Platform differences the tests work around

- The iOS keyboard closes through the WKWebView toolbar's **Done** button.
  Maestro's `hideKeyboard` gestures on the page and can open the currency
  picker.
- After a party is created, its toasts overlap the floating **Add an expense**
  button. Touching a toast pauses its timer for good, so both suites tap the
  button's uncovered right edge. Maestro can only tap screen positions, so
  `.maestro/subflows/tap-add-expense.yaml` holds one point per platform.
- In the iOS accessibility tree, web headings read as `other` with their level
  as the value. Match them by text, not by the `heading` role.
- The accessibility trees of the two WebViews differ. Android exposes links as
  plain groups, a field's label and help text only as its placeholder, and
  toggles as checkboxes; iOS names fields after their labels and reads toggles
  as switches. Match links by text, fields with `textField()` from
  `e2e/fields.ts`, and toggles by either role.
