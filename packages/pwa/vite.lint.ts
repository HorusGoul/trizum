import type { UserConfig } from "vite-plus";

export const lintOverrides = [
  {
    files: ["src/main.tsx", "src/routes/**/*.tsx"],
    rules: {
      "react/only-export-components": "off",
    },
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/lib/testing/**/*.ts"],
    rules: {
      "vitest/require-mock-type-parameters": "off",
    },
  },
  {
    files: ["src/lib/expenses.test.ts"],
    rules: {
      "vitest/valid-expect": "off",
    },
  },
] satisfies NonNullable<NonNullable<UserConfig["lint"]>["overrides"]>;
