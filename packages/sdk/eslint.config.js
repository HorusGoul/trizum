import { defineConfig } from "eslint/config";
import baseConfig from "@trizum/eslint-config/base";

export default defineConfig([
  baseConfig,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
  },
]);
