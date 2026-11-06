import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import linguiMacro from "@lingui/babel-plugin-lingui-macro";
import { getConfig } from "@lingui/conf";
import { fileURLToPath } from "node:url";
import { createIconSpritePlugin } from "@trizum/icon-sprite/vite";
import { createUIIconSpriteConfig } from "../src/icons.ts";

const linguiConfig = getConfig({
  configPath: fileURLToPath(new URL("../lingui.config.ts", import.meta.url)),
});

export default defineConfig(({ command }) => ({
  // Develop against source for hot reload; production stories exercise dist exports.
  resolve:
    command === "serve"
      ? {
          alias: [
            {
              find: /^@trizum\/ui\/(?!locales\/)(.+)$/,
              replacement: fileURLToPath(new URL("../src/", import.meta.url)) + "$1",
            },
          ],
        }
      : undefined,
  plugins: [
    react(),
    tailwindcss(),
    ...(command === "serve"
      ? [babel({ include: /\/src\/.*\.[jt]sx?$/, plugins: [[linguiMacro, { linguiConfig }]] })]
      : []),
    createIconSpritePlugin(createUIIconSpriteConfig(["src", "stories"])),
  ],
}));
