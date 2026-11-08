import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "./playwright.config.ts";

const referenceURL = process.env.PLAYWRIGHT_REFERENCE_URL;

if (!referenceURL)
  throw new Error("Set PLAYWRIGHT_REFERENCE_URL to an origin/main E2E-harness build.");

const referenceDir = process.env.PLAYWRIGHT_REFERENCE_DIR;
const referencePort = new URL(referenceURL).port;

if (!base.use?.baseURL || new URL(base.use.baseURL).origin === new URL(referenceURL).origin) {
  throw new Error("Reference and candidate must have different origins.");
}

if (referenceDir && !referencePort)
  throw new Error("Use an explicit local port with PLAYWRIGHT_REFERENCE_DIR.");

export default defineConfig({
  ...base,
  testMatch: "**/visual/**/*.spec.ts",
  testIgnore: [],
  outputDir: "visual-results",
  snapshotPathTemplate: "{testDir}/../visual-results/reference/{projectName}/{testName}/{arg}{ext}",
  retries: 0,
  updateSnapshots: "none",
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["list"],
    ["html", { outputFolder: "visual-report", open: "never" }],
    ["./e2e/visual/reporter.ts"],
  ],
  metadata: {
    reference: process.env.VISUAL_REFERENCE_SHA ?? referenceURL,
    candidate: process.env.VISUAL_CANDIDATE_SHA ?? "working tree",
  },
  use: {
    ...base.use,
    trace: "retain-on-failure",
    timezoneId: "UTC",
    colorScheme: "dark",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  },
  webServer: [
    ...(Array.isArray(base.webServer)
      ? base.webServer
      : base.webServer
        ? [base.webServer]
        : []
    ).map((server) => ({ ...server, reuseExistingServer: false })),
    ...(referenceDir
      ? [
          {
            command: `vp run --filter @trizum/pwa preview --host 127.0.0.1 --port ${referencePort} --strictPort --outDir dist/client`,
            cwd: path.resolve(referenceDir),
            url: referenceURL,
            reuseExistingServer: false,
            timeout: 120_000,
          },
        ]
      : []),
  ],
  projects: (["chromium", "webkit"] as const).flatMap((browserName) => [
    {
      name: `${browserName}-mobile`,
      use: { browserName, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: `${browserName}-desktop`,
      use: {
        browserName,
        viewport: { width: 1280, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
  ]),
});
