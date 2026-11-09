import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "creative:preview": {
        command: "node src/creative-assets/cli.ts preview",
        dependsOn: ["@trizum/logging#build"],
        cache: false,
      },
      "creative:header": {
        command: "node src/creative-assets/cli.ts header",
        dependsOn: ["@trizum/logging#build"],
        cache: false,
      },
      "creative:search": {
        command: "node src/creative-assets/cli.ts search",
        dependsOn: ["@trizum/logging#build"],
        cache: false,
      },
      "creative:prepare": {
        command: "node src/creative-assets/cli.ts prepare",
        dependsOn: ["@trizum/logging#build"],
        cache: false,
      },
      "creative:validate": {
        command: "node src/creative-assets/cli.ts validate",
        dependsOn: ["@trizum/logging#build"],
        cache: false,
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
});
