import type { LinguiConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";

const config: LinguiConfig = {
  compileNamespace: "ts",
  sourceLocale: "en",
  format: formatter(),
  locales: ["en"],
  fallbackLocales: {
    default: "en",
  },
  rootDir: ".",
};

export default config;
