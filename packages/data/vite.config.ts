import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "fate-jazz": fileURLToPath(new URL("../fate-jazz/src/index.ts", import.meta.url)),
    },
  },
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
    name: "data",
  },
});
