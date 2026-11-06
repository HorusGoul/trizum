import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import linguiMacro from "@lingui/babel-plugin-lingui-macro";
import { getConfig } from "@lingui/conf";
import { fileURLToPath } from "node:url";

const linguiConfig = getConfig({
  configPath: fileURLToPath(new URL("../lingui.config.ts", import.meta.url)),
});

export function createUIReactPlugins() {
  return [
    // Expand Lingui macros before the React plugin compiles the components.
    babel({ include: /\/src\/.*\.[jt]sx?$/, plugins: [[linguiMacro, { linguiConfig }]] }),
    react({ compiler: true }),
  ];
}
