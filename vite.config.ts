import { defineConfig, type UserConfig } from "vite-plus";
import { ignorePatterns as mobileIgnorePatterns } from "./packages/mobile/vite.ignores";
import { ignorePatterns as pwaIgnorePatterns } from "./packages/pwa/vite.ignores";
import { ignorePatterns as serverIgnorePatterns } from "./packages/server/vite.ignores";

const rootAppCommandMessage = [
  "The workspace root is not an app package.",
  "",
  "Run repo scripts from the workspace root:",
  "  vp run dev",
  "  vp run build",
  "",
  "Or run package scripts from the package directory:",
  "  cd packages/pwa && vp run dev",
  "  cd packages/pwa && vp run build",
].join("\n");

const rootIgnorePatterns = [
  ".vite-hooks/**",
  "**/dist/**",
  "**/node_modules/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.tanstack/**",
  "**/.wrangler/**",
];

// Vite+ workspace checks read lint/fmt settings from the root config, so the
// root composes package-owned generated paths colocated with package Vite config.
function packageIgnorePatterns(packageRoot: string, ignorePatterns: string[]) {
  return ignorePatterns.flatMap((ignorePattern) => [
    ignorePattern,
    `${packageRoot}/${ignorePattern}`,
  ]);
}

const ignorePatterns = [
  ...rootIgnorePatterns,
  ...packageIgnorePatterns("packages/mobile", mobileIgnorePatterns),
  ...packageIgnorePatterns("packages/pwa", pwaIgnorePatterns),
  ...packageIgnorePatterns("packages/server", serverIgnorePatterns),
];

// Agent skill docs are maintained outside the app/tooling source tree; keep
// them out of formatting checks so routine validation does not reflow them.
const formatIgnorePatterns = [".agents/**", ...ignorePatterns];

function rootAppCommandGuard() {
  return {
    config() {
      if (process.env.VP_COMMAND !== "dev" && process.env.VP_COMMAND !== "build") {
        return;
      }

      const error = new Error(rootAppCommandMessage);
      error.stack = rootAppCommandMessage;
      throw error;
    },
    enforce: "pre",
    name: "trizum-root-app-command-guard",
  } satisfies NonNullable<UserConfig["plugins"]>[number];
}

const toolingConfig = {
  fmt: {
    ignorePatterns: formatIgnorePatterns,
    sortPackageJson: true,
    sortTailwindcss: true,
  },
  lint: {
    env: {
      browser: true,
      es2024: true,
      node: true,
    },
    ignorePatterns,
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
      {
        name: "lingui",
        specifier: "eslint-plugin-lingui",
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["import", "jsx-a11y", "react", "typescript", "vitest"],
    rules: {
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
      "lingui/no-expression-in-message": "warn",
      "lingui/no-single-tag-to-translate": "warn",
      "lingui/no-single-variables-to-translate": "warn",
      "lingui/no-trans-inside-trans": "warn",
      "lingui/t-call-in-function": "error",
      "no-console": "error",
      "no-unused-vars": "off",
      "react/exhaustive-deps": "error",
      "react/only-export-components": "warn",
      "react/react-in-jsx-scope": "off",
      "react/rules-of-hooks": "error",
      "typescript/consistent-type-imports": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    settings: {
      react: {
        version: "19.0.0",
      },
    },
    overrides: [
      {
        files: ["packages/pwa/src/main.tsx", "packages/pwa/src/routes/**/*.tsx"],
        rules: {
          "react/only-export-components": "off",
        },
      },
      {
        files: [
          "packages/*/src/**/*.test.ts",
          "packages/*/src/**/*.test.tsx",
          "packages/pwa/src/lib/testing/**/*.ts",
        ],
        rules: {
          "vitest/require-mock-type-parameters": "off",
        },
      },
      {
        files: ["packages/pwa/src/lib/expenses.test.ts"],
        rules: {
          "vitest/valid-expect": "off",
        },
      },
      {
        files: ["packages/server/src/main.ts"],
        rules: {
          "typescript/no-misused-spread": "off",
        },
      },
    ],
  },
  staged: {
    "*": "vp check --fix",
  },
  plugins: [rootAppCommandGuard()],
  run: {
    cache: {
      scripts: true,
      tasks: true,
    },
  },
} satisfies UserConfig;

export default defineConfig(toolingConfig);
