import { configDefaults, defineConfig, type UserConfig } from "vite-plus";

const rootAppCommandMessage = [
  "The workspace root is not an app package.",
  "",
  "Run app commands from a package instead:",
  "  cd packages/pwa && vp dev",
  "  cd packages/pwa && vp run build",
  "",
  "From the workspace root, pass the package root or run package scripts:",
  "  vp dev packages/pwa",
  "  vp run --filter @trizum/pwa build",
  "  vp run build",
].join("\n");

const ignoredPaths = [
  ".agents/**",
  ".vite-hooks/**",
  "**/dist/**",
  "**/node_modules/**",
  "**/coverage/**",
  "**/.turbo/**",
  "**/.tanstack/**",
  "**/.wrangler/**",
  "packages/mobile/android/**",
  "packages/mobile/ios/**",
  "packages/pwa/api/types.d.ts",
  "packages/pwa/src/generated/**",
  "packages/pwa/src/routeTree.gen.ts",
  "packages/server/drizzle/meta/**",
  "api/types.d.ts",
  "src/generated/**",
  "src/routeTree.gen.ts",
];

const lintIgnoredPaths = [...ignoredPaths, "packages/pwa/api/**", "packages/pwa/e2e/**"];

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
    ignorePatterns: ignoredPaths,
    sortPackageJson: true,
    sortTailwindcss: true,
  },
  lint: {
    env: {
      browser: true,
      es2024: true,
      node: true,
    },
    ignorePatterns: lintIgnoredPaths,
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
        files: ["packages/pwa/src/main.tsx"],
        rules: {
          "react/only-export-components": "off",
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
  test: {
    projects: [
      {
        root: "packages/icon-sprite",
        test: {
          include: ["src/**/*.test.ts"],
          name: "icon-sprite",
        },
      },
      {
        root: "packages/logging",
        test: {
          include: ["src/**/*.test.ts"],
          name: "logging",
        },
      },
      {
        extends: "./packages/pwa/vite.config.ts",
        root: "packages/pwa",
        test: {
          exclude: [...configDefaults.exclude, "e2e/**"],
          include: ["src/**/*.test.ts"],
          name: "pwa",
        },
      },
      {
        root: "packages/ts-template",
        test: {
          include: ["src/**/*.test.ts"],
          name: "ts-template",
        },
      },
    ],
  },
} satisfies UserConfig;

export default defineConfig(toolingConfig);
