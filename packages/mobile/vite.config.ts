import { defineConfig } from "vite-plus";

const generatedIgnoredPaths = ["android/**", "ios/**"];

export default defineConfig({
  fmt: {
    ignorePatterns: generatedIgnoredPaths,
  },
  lint: {
    ignorePatterns: generatedIgnoredPaths,
  },
});
