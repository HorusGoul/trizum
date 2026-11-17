import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: "trizum-widget-font-subsets",
          AtRule: {
            "font-face": (rule) => {
              // Keep the shared fonts for English/Spanish; other scripts use system fallback.
              const range = rule.nodes?.find(
                (node) => node.type === "decl" && node.prop === "unicode-range",
              );

              if (
                range?.type === "decl" &&
                !/U\+(?:\?\?|0{1,4}-(?:00)?FF)(?:,|$)/i.test(range.value)
              )
                rule.remove();
            },
          },
        },
      ],
    },
  },
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
