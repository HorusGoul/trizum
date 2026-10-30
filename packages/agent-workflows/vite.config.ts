import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "NODE_ENV=production tsc -b tsconfig.json --force",
        dependsOn: ["@trizum/logging#build"],
        cache: {
          output: ["dist/**"],
        },
      },
      check: {
        command: "vp check .",
        dependsOn: ["@trizum/logging#build"],
      },
      test: {
        command: "vp test .",
        dependsOn: ["@trizum/logging#build"],
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "agent-workflows",
  },
});
