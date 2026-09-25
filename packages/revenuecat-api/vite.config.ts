import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "NODE_ENV=production tsc -b tsconfig.json --force",
        dependsOn: ["generate"],
        input: [{ auto: true }, "src/**", "!dist/**", "!**/*.tsbuildinfo"],
        output: ["dist/**"],
      },
      check: {
        command: "vp check .",
        dependsOn: ["generate"],
      },
      generate: {
        command: ["openapi-ts", "vp check --fix src/generated"],
        input: [{ auto: true }, "!src/generated/**"],
        output: ["src/generated/**"],
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
