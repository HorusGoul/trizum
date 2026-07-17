import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
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
});
