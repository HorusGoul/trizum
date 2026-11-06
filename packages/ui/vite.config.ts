import { defineConfig } from "vite-plus";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUIReactPlugins } from "./build/react.ts";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));

const entries = Object.fromEntries(
  readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|d)\.tsx?$/.test(file))
    .map((file) => [file.replace(/\.tsx?$/, ""), path.resolve(sourceRoot, file)]),
);

const dependencies = [
  "@trizum/icon-sprite#build",
  "@trizum/tw-dynamic-themes#build",
  "@trizum/tailwindcss-safe-area-capacitor#build",
];

export default defineConfig({
  plugins: [createUIReactPlugins()],
  build: {
    lib: { entry: entries, formats: ["es"] },
    minify: false,
    rolldownOptions: {
      external: (id) => !id.startsWith(".") && !path.isAbsolute(id) && !id.startsWith("\0"),
      output: {
        preserveModules: true,
        preserveModulesRoot: sourceRoot,
        entryFileNames: "[name].js",
      },
    },
  },
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
        command: "vp build && tsc -b tsconfig.json --force --emitDeclarationOnly",
        dependsOn: ["codegen"],
        cache: {
          input: [
            "src/**",
            "build/**",
            "vite.config.ts",
            "tsconfig.json",
            "lingui.config.ts",
            "package.json",
          ],
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
