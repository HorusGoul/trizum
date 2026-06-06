import type { UserConfig } from "vite-plus";

export const lintOverrides = [
  {
    files: ["src/main.ts"],
    rules: {
      "typescript/no-misused-spread": "off",
    },
  },
] satisfies NonNullable<NonNullable<UserConfig["lint"]>["overrides"]>;
