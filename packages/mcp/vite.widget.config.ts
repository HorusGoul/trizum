import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    minify: true,
    emptyOutDir: false,
    lib: {
      entry: "src/widget.tsx",
      formats: ["iife"],
      name: "TrizumParty",
      fileName: () => "widget.js",
      cssFileName: "widget",
    },
  },
});
