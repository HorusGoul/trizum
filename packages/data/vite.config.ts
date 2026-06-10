import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

const jazzCloudEnv = [
  "JAZZ_ADMIN_SECRET",
  "JAZZ_APP_ID",
  "JAZZ_SERVER_URL",
  "VITE_JAZZ_APP_ID",
  "VITE_JAZZ_SERVER_URL",
];

export default defineConfig({
  resolve: {
    alias: {
      "fate-jazz": fileURLToPath(new URL("../fate-jazz/src/index.ts", import.meta.url)),
    },
  },
  run: {
    tasks: {
      build: {
        command: "tsc -b tsconfig.json --force",
        output: ["dist/**"],
      },
      check: {
        command: "vp check .",
      },
      test: {
        command: "vp test .",
      },
      "jazz:deploy": {
        command: "node scripts/jazz-cli.mjs deploy",
        env: jazzCloudEnv,
      },
      "jazz:migrations:create": {
        command: "node scripts/jazz-cli.mjs migrations:create",
        env: jazzCloudEnv,
      },
      "jazz:migrations:push": {
        command: "node scripts/jazz-cli.mjs migrations:push",
        env: jazzCloudEnv,
      },
      "jazz:permissions:status": {
        command: "node scripts/jazz-cli.mjs permissions:status",
        env: jazzCloudEnv,
      },
      "jazz:schema:export": {
        command: "node scripts/jazz-cli.mjs schema:export",
      },
      "jazz:schema:hash": {
        command: "node scripts/jazz-cli.mjs schema:hash",
      },
      "jazz:validate": {
        command: "node scripts/jazz-cli.mjs validate",
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "data",
  },
});
