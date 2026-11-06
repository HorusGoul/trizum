import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "tsc -b tsconfig.json --force && vp build --config vite.widget.config.ts",
        cache: {
          input: ["src/**", "tsconfig.json", "package.json", "vite.widget.config.ts"],
          output: ["dist/**"],
        },
      },
      check: {
        command: "vp check .",
      },
      test: {
        command: "vp test .",
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "mcp",
  },
});
