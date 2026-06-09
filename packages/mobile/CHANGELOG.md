# @trizum/mobile

## 1.9.0

### Patch Changes

- [#174](https://github.com/HorusGoul/trizum/pull/174) [`78c5a03`](https://github.com/HorusGoul/trizum/commit/78c5a034cce38d90c004b422fc36091ac7baaeb4) Thanks [@HorusGoul](https://github.com/HorusGoul)! - Prevent Android startup from invoking Google Play in-app update checks on unsupported installs or devices without Google Play support.

- Updated dependencies [[`7c6e272`](https://github.com/HorusGoul/trizum/commit/7c6e272d04128c4d8d422c9d65166d9dc338a46e), [`9f8611e`](https://github.com/HorusGoul/trizum/commit/9f8611e8994886becbc9945e2c67f82f54a17430), [`162e385`](https://github.com/HorusGoul/trizum/commit/162e385c74b8b5d06df33f4bc90542f36c570ec2), [`a2881ed`](https://github.com/HorusGoul/trizum/commit/a2881edf589180216b031fd4c7db3f20fae722d6), [`78c5a03`](https://github.com/HorusGoul/trizum/commit/78c5a034cce38d90c004b422fc36091ac7baaeb4), [`f27ff00`](https://github.com/HorusGoul/trizum/commit/f27ff00cdf06d88d5bd1f4a702f8784c461f62ba), [`9e6893a`](https://github.com/HorusGoul/trizum/commit/9e6893a77e4bb31be3a9695f58aef50cf92edd61)]:
  - @trizum/pwa@1.9.0

## 1.8.0

### Patch Changes

- 92c0ea9: Migrate the PWA's virtualized emoji picker and expense log from `@tanstack/react-virtual` to `react-window`.

  This keeps the existing user flows intact while simplifying scroll restoration and removing the React 19 workaround the old virtualization layer required.

- Updated dependencies [09ef7ba]
- Updated dependencies [92c0ea9]
- Updated dependencies [0ce9a2a]
  - @trizum/pwa@1.8.0

## 1.7.0

### Patch Changes

- Updated dependencies [750a8f6]
- Updated dependencies [a42ebec]
- Updated dependencies [9116b2b]
- Updated dependencies [652cf7a]
  - @trizum/pwa@1.7.0

## 1.6.1

### Patch Changes

- Updated dependencies [344b355]
- Updated dependencies [d00e326]
- Updated dependencies [85bbffe]
- Updated dependencies [0e95819]
- Updated dependencies [925914c]
  - @trizum/pwa@1.6.1

## 1.6.0

### Patch Changes

- Updated dependencies [9d73432]
- Updated dependencies [7e08bca]
  - @trizum/pwa@1.6.0

## 1.5.1

### Patch Changes

- Updated dependencies [605b6c1]
  - @trizum/pwa@1.5.1

## 1.5.0

### Patch Changes

- 25b1d73: Upgrade Capacitor to v8
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

- Updated dependencies [1b3e4f5]
- Updated dependencies [308ac3c]
- Updated dependencies [25b1d73]
  - @trizum/pwa@1.5.0

## 1.4.1

### Patch Changes

- Updated dependencies [f2302c0]
  - @trizum/pwa@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies [fee737b]
- Updated dependencies [007f6bb]
  - @trizum/pwa@1.4.0

## 1.3.0

### Minor Changes

- b387fe2: App now defaults to "system" locale and app's language can be changed in system settings.

### Patch Changes

- Updated dependencies [b387fe2]
- Updated dependencies [7d26de5]
  - @trizum/pwa@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [679d1b2]
- Updated dependencies [cd8c592]
- Updated dependencies [6e913ab]
  - @trizum/pwa@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [06020bd]
- Updated dependencies [e9a4eec]
- Updated dependencies [f477b6b]
  - @trizum/pwa@1.1.0

## 1.0.6

### Patch Changes

- Updated dependencies [6497ec6]
- Updated dependencies [1e75b8c]
  - @trizum/pwa@1.0.6

## 1.0.5

### Patch Changes

- Updated dependencies [1b5ed07]
- Updated dependencies [666de10]
  - @trizum/pwa@1.0.5

## 1.0.4

### Patch Changes

- f386729: Fix party sharing
- Updated dependencies [f386729]
- Updated dependencies [fa9bcd2]
- Updated dependencies [a140c8a]
  - @trizum/pwa@1.0.4

## 1.0.3

### Patch Changes

- overwrite_screenshots: true for the full deploy lane
  - @trizum/pwa@1.0.3

## 1.0.2

### Patch Changes

- c6c06b2: Add NSCameraUsageDescription
  - @trizum/pwa@1.0.2

## 1.0.1

### Patch Changes

- Update assets
  - @trizum/pwa@1.0.1

## 1.0.0

### Major Changes

- bc9e06d: Bumping to 1.0.0

### Patch Changes

- Updated dependencies [bc9e06d]
  - @trizum/pwa@1.0.0
