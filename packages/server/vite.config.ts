import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      check: {
        command: "vp check .",
        dependsOn: ["@trizum/logging#build"],
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "server",
  },
  pack: {
    deps: {
      alwaysBundle: /.*/,
      neverBundle: [/^@sentry-internal\/node-cpu-profiler/],
      onlyBundle: false,
    },
    entry: ["src/cli.ts"],
    dts: false,
    format: "esm",
    outDir: "build",
    sourcemap: false,
  },
});
