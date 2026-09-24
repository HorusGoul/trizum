import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "NODE_ENV=production tsc -b tsconfig.json --force",
        dependsOn: ["generate"],
        output: ["dist/**"],
      },
      check: {
        command: "vp check .",
        dependsOn: ["generate"],
      },
      generate: {
        command: "vp run generate:client",
        output: ["src/generated/customerResources.gen.ts"],
      },
      test: {
        command: "vp test .",
        dependsOn: ["generate"],
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "revenuecat-api",
  },
});
