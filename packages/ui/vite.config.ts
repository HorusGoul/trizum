import { defineConfig } from "vite-plus";

const dependencies = [
  "@trizum/icon-sprite#build",
  "@trizum/tw-dynamic-themes#build",
  "@trizum/tailwindcss-safe-area-capacitor#build",
];

export default defineConfig({
  run: {
    tasks: {
      codegen: {
        command: [
          "node ../icon-sprite/dist/cli.js ./iconSprite.config.mjs",
          "vp exec twdt accent 250 src/generated/tw-dynamic-themes.css",
          "vp run lingui:compile",
        ],
        dependsOn: dependencies,
        cache: false,
      },
      build: {
        command: "tsc -b tsconfig.json --force && node scripts/compile-macros.ts",
        dependsOn: ["codegen"],
        cache: {
          input: ["src/**", "scripts/**", "tsconfig.json", "lingui.config.ts", "package.json"],
          output: ["dist/**", "src/generated/**", "src/locales/*/messages.ts"],
        },
      },
      check: { command: "vp check .", dependsOn: ["build"] },
      test: { command: "vp test .", dependsOn: ["build"] },
      "storybook:dev": {
        command: "vp exec storybook dev --port 6006 --no-open",
        dependsOn: ["build"],
        cache: false,
      },
      "storybook:build": {
        command: "tsc -p tsconfig.storybook.json && vp exec storybook build --disable-telemetry",
        dependsOn: ["build"],
        cache: { output: ["storybook-static/**"] },
      },
    },
  },
  test: { name: "ui", include: ["src/**/*.test.{ts,tsx}"] },
});
