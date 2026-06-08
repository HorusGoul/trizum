import type { LinguiConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const config: LinguiConfig = {
  compileNamespace: "ts",
  sourceLocale: "en",
  format: formatter(),
  locales: ["en", "es"],
  fallbackLocales: {
    default: "en",
  },
  rootDir,
};

export default config;
