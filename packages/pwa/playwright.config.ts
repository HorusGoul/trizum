/// <reference types="node" />

import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = 4173;
const host = "127.0.0.1";
const localBaseURL = `http://${host}:${port}`;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? localBaseURL;
const cwd = path.dirname(fileURLToPath(import.meta.url));
const webServerCommand = [
  "VITE_APP_DISABLE_SENTRY=true vp run build",
  `vp run preview -- --host ${host} --port ${port} --strictPort --outDir dist/client`,
].join(" && ");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: webServerCommand,
        url: localBaseURL,
        reuseExistingServer: !process.env.CI,
        cwd,
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
      },
    },
  ],
});
