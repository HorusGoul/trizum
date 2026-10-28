# Mobile development

[Back to package overview](../README.md). Read when setting up or running native builds. Commands use the working directories shown below; unqualified package commands run from `packages/mobile`.

## Prerequisites

- **Vite+ (`vp`)** for the repo-managed Node.js and package manager versions
- **For iOS:**
  - macOS with Xcode 15+
  - CocoaPods from the iOS bundle
  - Apple Developer account (for device testing/distribution)
- **For Android:**
  - Android Studio with SDK 35
  - Java 17+
- **Fastlane** (for automated builds), installed through the native bundles

## Getting Started

### Initial Setup

```bash
# From repo root
vp install
vp run --filter @trizum/pwa build
```

### Native Ruby Environment

`vp run build` runs Capacitor sync. On macOS, Capacitor uses the iOS
`Gemfile.lock` to run `bundle exec pod install`, so use the repo mise config to
match the Ruby version used by CI:

```bash
# From repo root
mise trust
mise install
mise exec -- gem install bundler:2.7.2
(cd packages/mobile/ios/App && mise exec -- bundle install)

cd packages/mobile
vp run build
```

The Android and iOS Gemfile directories contain `mise.toml` symlinks to the
workspace root config so CI `ruby/setup-ruby` resolves the same Ruby version
while installing package-local bundles.

### Development

For live development with hot reload:

1. Create a `.env` file in `packages/mobile`:

```bash
DEV_URL=http://YOUR_LOCAL_IP:5173
```

2. Start the PWA dev server:

```bash
cd packages/pwa
vp run dev -- --host
```

3. Run on device/simulator:

```bash
cd packages/mobile
vp run dev:android  # For Android
vp run dev:ios      # For iOS
```

### Opening in IDEs

```bash
vp run open:android  # Opens in Android Studio
vp run open:ios      # Opens in Xcode
```

## Scripts

| Script            | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `build`           | Copy PWA assets and sync Capacitor                     |
| `check`           | Run package validation                                 |
| `open:android`    | Open Android project in Android Studio                 |
| `open:ios`        | Open iOS project in Xcode                              |
| `run:android`     | Build and run on Android device/emulator               |
| `run:ios`         | Build and run on iOS device/simulator                  |
| `dev:android`     | Run in dev mode with live reload (Android)             |
| `dev:ios`         | Run in dev mode with live reload (iOS)                 |
| `assets:generate` | Generate app icons and splash screens                  |
| `assets:check`    | Check the generated Android splash vector for drift    |
| `sync:check`      | Fail if Capacitor sync changes mobile files            |
| `check:android`   | Validate Android sync, lint, tests, APK, and AAB build |
| `ruby:check`      | Dry-run Ruby bundles used by mobile CI                 |
