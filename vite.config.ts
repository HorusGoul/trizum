import { defineConfig, type UserConfig } from "vite-plus";
import reactDoctorConfig, { reactDoctorSettings } from "./doctor.config.ts";

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

// Vite+ workspace checks read lint/fmt settings from the root config. Keep
// package-relative and workspace-relative generated paths here so root checks
// and package-local `vp check .` commands skip the same generated outputs.
const ignorePatterns = [
  ".agent/**",
  ".agents/**",
  ".claude/**",
  ".codex/**",
  ".continue/**",
  ".cursor/**",
  ".gemini/**",
  ".opencode/**",
  ".pi/**",
  ".roo/**",
  ".windsurf/**",
  ".vite-hooks/**",
  "tools/oxlint/anti-slop/**",
  "**/dist/**",
  "**/node_modules/**",
  "**/coverage/**",
  "**/.tanstack/**",
  "**/.wrangler/**",
  "android/**",
  "ios/**",
  "api/types.d.ts",
  "src/generated/**",
  "src/routeTree.gen.ts",
  "drizzle/meta/**",
  "packages/mobile/android/**",
  "packages/mobile/ios/**",
  "packages/pwa/api/types.d.ts",
  "packages/pwa/src/generated/**",
  "packages/pwa/src/routeTree.gen.ts",
  "packages/server/build/**",
  "packages/server/drizzle/meta/**",
];

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
    ignorePatterns,
    sortPackageJson: true,
    sortTailwindcss: true,
  },
  lint: {
    categories: {
      correctness: "error",
    },
    env: {
      browser: true,
      es2024: true,
      node: true,
    },
    ignorePatterns,
    jsPlugins: [
      {
        name: "anti-slop",
        specifier: "./tools/oxlint/anti-slop/index.ts",
      },
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
      {
        name: "lingui",
        specifier: "eslint-plugin-lingui",
      },
      {
        name: "react-doctor",
        specifier: "oxlint-plugin-react-doctor",
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["import", "jsx-a11y", "react", "typescript", "vitest"],
    rules: {
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "off", // https://github.com/HorusGoul/trizum/issues/565
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "off", // https://github.com/HorusGoul/trizum/issues/562
      "anti-slop/no-module-mocking": "off", // https://github.com/HorusGoul/trizum/issues/584
      "anti-slop/no-object-parameters": "off", // https://github.com/HorusGoul/trizum/issues/563
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "off", // https://github.com/HorusGoul/trizum/issues/569
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "off", // https://github.com/HorusGoul/trizum/issues/568
      "anti-slop/no-unknown-returns": "off", // https://github.com/HorusGoul/trizum/issues/567
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "off", // https://github.com/HorusGoul/trizum/issues/564
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "off", // https://github.com/HorusGoul/trizum/issues/566
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
      "lingui/no-expression-in-message": "error",
      "lingui/no-single-tag-to-translate": "error",
      "lingui/no-single-variables-to-translate": "error",
      "lingui/no-trans-inside-trans": "error",
      "lingui/t-call-in-function": "error",
      "no-console": "error",
      "no-unused-vars": "off",
      "oxc/no-accumulating-spread": "error",
      "react/exhaustive-deps": "error",
      "react/only-export-components": "error",
      "react/react-in-jsx-scope": "off",
      "react/rules-of-hooks": "error",
      "typescript/consistent-type-imports": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    settings: {
      "react-doctor": reactDoctorSettings,
      react: {
        version: "19.0.0",
      },
    },
    overrides: [
      {
        files: ["packages/pwa/src/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
        rules: reactDoctorConfig.rules,
      },
      {
        files: [
          "packages/pwa/src/main.tsx",
          "packages/pwa/src/routes/**/*.tsx",
          "src/main.tsx",
          "src/routes/**/*.tsx",
        ],
        rules: {
          "react/only-export-components": "off",
        },
      },
      {
        files: ["**/*.test.{ts,tsx}"],
        rules: {
          // Test harnesses expose hook results during render and inspect mocks.
          "react/globals": "off",
          "typescript/unbound-method": "off",
        },
      },
    ],
  },
  staged: {
    "*": ["vp check --fix", () => "vp run lingui:extract"],
  },
  plugins: [rootAppCommandGuard()],
  run: {
    cache: {
      scripts: false,
      tasks: true,
    },
    tasks: {
      check: {
        command: "vp run --filter @trizum/pwa check && vp check",
        dependsOn: [
          "@trizum/logging#build",
          "@trizum/pwa#codegen",
          "@trizum/revenuecat-api#generate",
        ],
      },
      dev: {
        command: "vp run @trizum/pwa#dev",
        cache: false,
      },
      preview: {
        command: "vp run @trizum/pwa#preview",
        cache: false,
      },
      test: {
        command: "vp run --filter './packages/*' test",
        dependsOn: ["test:lint-plugins"],
      },
      "test:lint-plugins": {
        command: "node --test tools/oxlint/*.test.ts",
      },
      "test:coverage": {
        command: "vp run --filter './packages/*' test --coverage",
      },
    },
  },
} satisfies UserConfig;

export default defineConfig(toolingConfig);
