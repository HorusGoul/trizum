import type { E2EConfig } from "e2e";
import { mobile } from "@e2e-dev/mobile";

// E2E_APP_ID points the suite at a renamed build, such as a debug build with an
// applicationIdSuffix installed beside the store app.
const bundleId = process.env.E2E_APP_ID ?? "app.trizum.capacitor";

export default {
  tests: ["e2e/**/*.e2e.ts"],
  targets: [
    {
      name: "ios",
      engine: mobile({ platform: "ios", device: process.env.E2E_IOS_DEVICE }),
      app: { bundleId },
    },
    {
      name: "android",
      engine: mobile({ platform: "android", device: process.env.E2E_ANDROID_DEVICE }),
      app: { bundleId },
    },
  ],
  workers: 1,
} satisfies E2EConfig;
