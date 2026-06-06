import { defineConfig } from "vite-plus";
import { lintOverrides } from "./vite.lint";

export default defineConfig({
  lint: {
    overrides: lintOverrides,
  },
  test: {
    include: ["src/**/*.test.ts"],
    name: "icon-sprite",
  },
});
