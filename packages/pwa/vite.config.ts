import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { lingui } from "@lingui/vite-plugin";

const ReactCompilerConfig = {};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react({
      babel: {
        plugins: [
          "babel-plugin-macros",
          ["babel-plugin-react-compiler", ReactCompilerConfig],
        ],
      },
    }),
    wasm(),
    topLevelAwait(),
    lingui(),
  ],
});
