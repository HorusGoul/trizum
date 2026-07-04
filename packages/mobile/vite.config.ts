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
      "sync:check": {
        command: "./check-sync-clean.sh",
        cache: false,
        dependsOn: ["@trizum/pwa#build"],
      },
      "sync:check:android": {
        command: "./check-sync-clean.sh android",
        cache: false,
        dependsOn: ["@trizum/pwa#build"],
      },
      "sync:check:ios": {
        command: "./check-sync-clean.sh ios",
        cache: false,
        dependsOn: ["@trizum/pwa#build"],
      },
      "check:android": {
        command: "./check-android.sh",
        cache: false,
        dependsOn: ["@trizum/pwa#build"],
      },
      "ruby:check": {
        command: "./check-ruby-pipelines.sh",
        cache: false,
      },
      "ruby:check:android": {
        command: "./check-ruby-pipelines.sh android",
        cache: false,
      },
      "ruby:check:ios": {
        command: "./check-ruby-pipelines.sh ios",
        cache: false,
      },
    },
  },
});
