# Native wrapper

[Back to package overview](../README.md). Read when changing native lifecycle, configuration, plugins, or generated assets. Run asset commands from `packages/mobile`.

## Project Structure

```
packages/mobile/
├── android/              # Android native project
│   ├── app/              # Main Android app module
│   ├── fastlane/         # Fastlane configuration for Android
│   └── Gemfile           # Ruby dependencies for fastlane
├── ios/
│   └── App/              # iOS native project
│       ├── App/          # Main iOS app
│       ├── fastlane/     # Fastlane configuration for iOS
│       │   ├── Appfile           # App identifier config
│       │   ├── Fastfile          # Lane definitions
│       │   ├── Deliverfile       # App Store delivery config
│       │   ├── metadata/         # App Store listing content
│       │   ├── screenshots/      # App Store screenshots
│       │   └── rating_config.json # Age rating
│       └── Gemfile       # Ruby dependencies for fastlane
├── dist/                 # Copied PWA assets (gitignored)
├── assets/               # Source assets (icons, splash screens)
├── capacitor.config.ts   # Capacitor configuration
└── package.json
```

## iOS Scene Lifecycle

The iOS wrapper uses a single `UIWindowScene`, required for apps built with
the iOS 27 SDK. `Info.plist` assigns `Main.storyboard` to `SceneDelegate`;
UIKit creates the window and the existing `BridgeViewController`, which
registers the custom App Open ad plugin. Do not create a second bridge in
`SceneDelegate`.

Scene connection, URL contexts, and universal links are forwarded to
Capacitor's `SceneDelegateProxy`. This preserves cold-start link delivery
after plugin registration and the App plugin's `getLaunchUrl` behavior.
Capacitor also forwards scene background/foreground transitions to the web
view. Keep the Capacitor core, CLI, iOS, and Android versions aligned.

When changing this integration, verify a cold launch on iOS 27, background
and resume events, and custom-scheme/universal links with the app both
running and stopped. Check that native sign-in and the custom ad plugin
still use the storyboard's bridge controller.

## App Configuration

| Property           | Value                  |
| ------------------ | ---------------------- |
| App ID             | `app.trizum.capacitor` |
| iOS Deployment     | iOS 16.4+              |
| Android Min SDK    | 23 (Android 6.0)       |
| Android Target SDK | 35 (Android 15)        |

## Capacitor Plugins

- `@capacitor-community/admob` - consent, tracking permission, and interstitial ads
- `@capacitor/app` - App state and URL handling
- `@capacitor/splash-screen` - Native splash screen
- `@capawesome/capacitor-app-update` - In-app updates
- `capacitor-plugin-safe-area` - Safe area insets

## Generating Assets

To regenerate app icons and splash screens from source assets:

```bash
vp run assets:generate
```

Source assets are in `packages/mobile/assets/`.

The Android launch theme uses a native vector drawable generated from the
canonical mark in `packages/pwa/public/maskable.svg`. Run `assets:check` to
verify that the checked-in drawable matches that source.
