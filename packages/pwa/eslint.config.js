import { defineConfig } from "eslint/config";
import react from "@trizum/eslint-config/react"
import lingui from "eslint-plugin-lingui";

export default defineConfig([
  react,
  lingui.configs["flat/recommended"],
  {
    ignores: ["dist", "eslint.config.js"],
  },
  {
    rules: {
      "import/no-named-as-default-member": "off",
      "import/no-named-as-default": "off",
    }
  }
]);
