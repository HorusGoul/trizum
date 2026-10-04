import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "NODE_ENV=production tsc -b tsconfig.json --force",
        input: ["src/**", "tsconfig.json", "!dist/**", "!**/*.tsbuildinfo"],
        output: ["dist/**"],
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
    name: "logging",
  },
});
