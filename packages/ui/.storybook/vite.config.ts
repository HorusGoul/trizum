import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createIconSpritePlugin } from "@trizum/icon-sprite/vite";
import { fileURLToPath } from "node:url";
import { createUIReactPlugins } from "../build/react.ts";
import { createUIIconSpriteConfig } from "../src/icons.ts";

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
    ...(command === "serve" ? createUIReactPlugins() : [react()]),
    tailwindcss(),
    createIconSpritePlugin(createUIIconSpriteConfig(["src", "stories"])),
  ],
}));
