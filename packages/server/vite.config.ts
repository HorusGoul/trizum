import { defineConfig } from "vite-plus";
import { ignorePatterns } from "./vite.ignores";
import { lintOverrides } from "./vite.lint";

export default defineConfig({
  fmt: {
    ignorePatterns,
  },
  lint: {
    ignorePatterns,
    overrides: lintOverrides,
  },
});
