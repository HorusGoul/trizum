import type { LinguiConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";
import { fileURLToPath } from "node:url";

const config: LinguiConfig = {
  rootDir: fileURLToPath(new URL(".", import.meta.url)),
  sourceLocale: "en",
  locales: ["en", "es"],
  fallbackLocales: { default: "en" },
  compileNamespace: "ts",
  format: formatter(),
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["<rootDir>/src"],
      exclude: ["**/generated/**", "**/*.test.*"],
    },
  ],
};

export default config;
