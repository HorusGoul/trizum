---
"@trizum/mobile": patch
"@trizum/pwa": patch
---

Upgrade Capacitor to v8

- @capacitor/core: 7.4.4 → 8.0.1
- @capacitor/android: 7.4.4 → 8.0.1
- @capacitor/ios: 7.4.4 → 8.0.1
- @capacitor/app: 7.1.0 → 8.0.0
- @capacitor/share: 7.0.3 → 8.0.0
- @capacitor/splash-screen: 7.0.3 → 8.0.0
- @capawesome/capacitor-app-update: 7.2.0 → 8.0.1
- capacitor-plugin-safe-area: 4.0.3 → 5.0.0

Android:
- minSdkVersion: 23 → 24
- compileSdkVersion: 35 → 36
- targetSdkVersion: 35 → 36
- Gradle plugin: 8.7.2 → 8.13.0
- Gradle wrapper: 8.11.1 → 8.14.3
- Added density to configChanges

iOS:
- Minimum platform: 14.0 → 15.0

CI:
- Updated iOS workflows to use macos-26 for Xcode 26 SDK
