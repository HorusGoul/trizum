import { defineConfig } from "vite-plus";

export default defineConfig({
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
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "fate-jazz",
  },
});
