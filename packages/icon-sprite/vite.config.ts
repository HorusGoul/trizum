import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "NODE_ENV=production tsc -b tsconfig.json --force",
        cache: {
          input: ["src/**", "tsconfig.json", "package.json"],
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
    name: "icon-sprite",
  },
});
