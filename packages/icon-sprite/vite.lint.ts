import type { UserConfig } from "vite-plus";

export const lintOverrides = [
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "vitest/require-mock-type-parameters": "off",
    },
  },
] satisfies NonNullable<NonNullable<UserConfig["lint"]>["overrides"]>;
