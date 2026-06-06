import { defineConfig } from "vite-plus";

const generatedIgnoredPaths = ["drizzle/meta/**"];

export default defineConfig({
  fmt: {
    ignorePatterns: generatedIgnoredPaths,
  },
  lint: {
    ignorePatterns: generatedIgnoredPaths,
  },
});
