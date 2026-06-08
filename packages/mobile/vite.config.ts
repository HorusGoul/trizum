import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: "./copy-client.sh && ./sync.sh",
        cache: false,
        dependsOn: ["@trizum/pwa#build"],
      },
      check: {
        command: "vp check .",
        dependsOn: ["@trizum/pwa#build", "@trizum/logging#build"],
      },
    },
  },
});
