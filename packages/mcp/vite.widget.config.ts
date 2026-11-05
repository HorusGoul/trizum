import { defineConfig } from "vite-plus";

export default defineConfig({
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    minify: true,
    emptyOutDir: false,
    lib: {
      entry: "src/widget.tsx",
      formats: ["iife"],
      name: "TrizumParty",
      fileName: () => "widget.js",
    },
  },
});
