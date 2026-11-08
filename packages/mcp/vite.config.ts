import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      codegen: {
        command: "node ../icon-sprite/dist/cli.js ./iconSprite.config.mjs",
        dependsOn: ["@trizum/ui#build"],
        cache: false,
      },
      build: {
        command:
          "tsc -b tsconfig.json --force && vp build --config vite.widget.config.ts && cp src/generated/iconSprite.svg dist/widget.svg",
        dependsOn: ["codegen"],
        cache: {
          input: [
            "src/**",
            "iconSprite.config.mjs",
            "tsconfig.json",
            "package.json",
            "vite.widget.config.ts",
          ],
          output: ["dist/**"],
        },
      },
      check: {
        command: "vp check .",
        dependsOn: ["build"],
      },
      test: {
        command: "vp test .",
        dependsOn: ["build"],
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "mcp",
  },
});
