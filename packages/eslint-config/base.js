import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  prettierConfig,
  {
    plugins: {
      prettier: prettier,
      "unused-imports": unusedImports,
    },
    rules: {
      "prettier/prettier": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/only-throw-error": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "import/no-unresolved": "off",
      "import/no-named-as-default-member": "off",
      "import/consistent-type-specifier-style": "off",
    },
  },
]);
