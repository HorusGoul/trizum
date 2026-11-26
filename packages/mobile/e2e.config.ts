import type { E2EConfig } from "e2e";
import { mobile } from "@e2e-dev/mobile";

const bundleId = "app.trizum.capacitor";

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
