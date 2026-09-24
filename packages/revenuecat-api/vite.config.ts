import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "NODE_ENV=production tsc -b tsconfig.json --force",
        output: ["dist/**"],
      },
      check: {
        command: "vp check .",
      },
      generate: {
        command: "vp run generate:client",
        cache: false,
      },
      test: {
        command: "vp test .",
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "revenuecat-api",
  },
});
