import { defineConfig } from "vite-plus";
import { ignorePatterns } from "./vite.ignores";

export default defineConfig({
  fmt: {
    ignorePatterns,
  },
  lint: {
    ignorePatterns,
  },
});
