import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      check: { command: "vp check ." },
      build: { command: "vp check --no-fmt --no-lint ." },
      test: { command: "vp test ." },
    },
  },
  test: { name: "infra", include: ["src/**/*.test.ts"] },
});
