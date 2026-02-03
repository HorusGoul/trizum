import { defineConfig } from "eslint/config";
import react from "@trizum/eslint-config/react"
import lingui from "eslint-plugin-lingui";
import reactRenderTypesPlugin from "eslint-plugin-react-render-types";

const reactRenderTypes = reactRenderTypesPlugin.default ?? reactRenderTypesPlugin;

export default defineConfig([
  react,
  lingui.configs["flat/recommended"],
  reactRenderTypes.configs.recommended,
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
