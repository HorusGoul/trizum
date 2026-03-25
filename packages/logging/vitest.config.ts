import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@trizum/logging/github-actions",
        replacement: fileURLToPath(
          new URL("./src/github-actions.ts", import.meta.url),
        ),
      },
      {
        find: "@trizum/logging",
        replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
