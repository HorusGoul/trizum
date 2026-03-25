import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "eslint/config";
import baseConfig from "@trizum/eslint-config/base";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
  baseConfig,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.test.json",
        projectService: false,
        tsconfigRootDir: rootDir,
      },
    },
  },
]);
