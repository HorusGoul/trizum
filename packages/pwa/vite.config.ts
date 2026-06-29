import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getConfig as getLinguiConfig } from "@lingui/conf";
import type { Plugin } from "vite-plus";
import { configDefaults, defineConfig, perEnvironmentPlugin } from "vite-plus";
import react from "@vitejs/plugin-react";
import babel, { defineRolldownBabelPreset } from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { lingui } from "@lingui/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import license from "rollup-plugin-license";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { createIconSpritePlugin } from "../icon-sprite/src/vite";
import iconSpriteConfig from "./iconSprite.config.mjs";

const ReactCompilerConfig = {};
const sentryOrg = "horusdev";
const sentryProject = "trizum-pwa";
const buildTarget = ["edge88", "firefox78", "chrome87", "safari14.1"];

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const packageRequire = createRequire(new URL("package.json", import.meta.url));
const sentryCliBin = packageRequire.resolve("@sentry/cli/bin/sentry-cli");
const linguiConfigPath = path.resolve(packageRoot, "lingui.config.ts");
const linguiConfig = getLinguiConfig({
  cwd: packageRoot,
  configPath: linguiConfigPath,
});
const linguiBabelPlugin = packageRequire.resolve("@lingui/babel-plugin-lingui-macro");
const reactCompilerBabelPlugin = packageRequire.resolve("babel-plugin-react-compiler");
const reactCompilerPreset = defineRolldownBabelPreset({
  preset: () => ({
    plugins: [[reactCompilerBabelPlugin, ReactCompilerConfig]],
  }),
  rolldown: {
    filter: { code: /\b[A-Z]|\buse/ },
    applyToEnvironmentHook: (env: { config: { consumer?: string } }) =>
      env.config.consumer === "client",
    optimizeDeps: {
      include: ["react/compiler-runtime"],
    },
  },
});

// Read package.json version
const packageJson = JSON.parse(
  readFileSync(path.resolve(packageRoot, "package.json"), "utf-8"),
) as { version: string; description: string };
const appVersion = packageJson.version;
const description = packageJson.description;

// Get git commit hash
let appCommit = "unknown";
try {
  appCommit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Git not available or not in a git repository
  process.stderr.write("Could not determine git commit hash\n");
}

const fullVersion = `${appVersion}-${appCommit}`;
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isTest = mode === "test" || process.env.VITEST === "true";
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const hasSentryAuthToken = Boolean(sentryAuthToken);

  process.env.VITE_APP_WSS_URL =
    mode === "production" ? "wss://server.trizum.app/sync" : "wss://dev-sync.trizum.app";
  process.env.VITE_APP_AUTH_URL =
    process.env.VITE_APP_AUTH_URL ?? (mode === "production" ? "https://trizum.app" : "");
  process.env.VITE_APP_VERSION = appVersion;
  process.env.VITE_APP_COMMIT = appCommit;
  process.env.VITE_APP_FULL_VERSION = fullVersion;

  return {
    run: {
      tasks: {
        build: {
          command: "vp build",
          dependsOn: ["@trizum/logging#build", "icons:generate"],
          env: ["SENTRY_AUTH_TOKEN", "VITE_APP_AUTH_URL"],
          output: ["dist/**"],
        },
        check: {
          command: "vp check . && vp exec wrangler d1 migrations apply DB --local",
          dependsOn: ["@trizum/logging#build", "icons:generate"],
        },
        deploy: {
          command: "vp exec wrangler deploy",
          cache: false,
          dependsOn: ["build"],
        },
        dev: {
          command: "vp dev",
          cache: false,
          dependsOn: ["@trizum/logging#build", "icons:generate"],
        },
        "icons:generate": {
          command: "node ../icon-sprite/dist/cli.js ./iconSprite.config.mjs",
          dependsOn: ["@trizum/icon-sprite#build"],
          input: [{ auto: true }, "!src/generated/**"],
          output: ["src/generated/iconSprite.svg", "src/generated/iconSprite.gen.ts"],
        },
        preview: {
          command: "vp preview",
          cache: false,
        },
        test: {
          command: "vp test .",
          dependsOn: ["@trizum/logging#build", "icons:generate"],
        },
        "test:e2e": {
          command: "vp exec playwright test",
          cache: false,
          dependsOn: ["@trizum/logging#build", "icons:generate"],
        },
        "test:e2e:headed": {
          command: "vp exec playwright test --headed",
          cache: false,
          dependsOn: ["@trizum/logging#build", "icons:generate"],
        },
      },
    },
    build: {
      target: buildTarget,
      sourcemap: true,
      minify: true,
    },
    worker: {
      format: "es",
      plugins: () => [wasm() as Plugin, topLevelAwait() as Plugin],
    },
    resolve: {
      alias: [
        {
          // Cloudflare Worker validation does not expose CommonJS require.
          find: /^debug$/,
          replacement: "debug/src/browser.js",
        },
      ],
    },
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
      include: ["api/**/*.test.ts", "src/**/*.test.ts"],
      name: "pwa",
    },
    plugins: [
      ...(isTest ? [] : [cloudflare()]),
      tanstackRouter(),
      react(),
      babel({
        include: /\/src\/.*\.[cm]?[jt]sx?$/,
        plugins: [[linguiBabelPlugin, { linguiConfig }]],
        presets: [reactCompilerPreset],
      }),
      wasm() as Plugin,
      clientTopLevelAwaitPlugin(),
      lingui({
        cwd: packageRoot,
        configPath: linguiConfigPath,
      }),
      createIconSpritePlugin(iconSpriteConfig),
      VitePWA({
        registerType: "prompt",
        workbox: {
          globPatterns: ["**/*.{js,wasm,css,html,svg}"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          additionalManifestEntries: [{ url: "/THIRD-PARTY-LICENSES.txt", revision: null }],
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        },
        outDir: "dist/client",
        manifest: {
          name: "trizum",
          short_name: "trizum",
          description,
          theme_color: "#000000",
          background_color: "#000000",
          display: "standalone",
          icons: [
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "pwa-64x64.png",
              sizes: "64x64",
              type: "image/png",
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
      // Generate third-party licenses file during build
      license({
        thirdParty: {
          includePrivate: false,
          output: {
            file: path.resolve(packageRoot, "dist/client", "THIRD-PARTY-LICENSES.txt"),
            template(dependencies) {
              return dependencies
                .map((dep) => {
                  const repository =
                    typeof dep.repository === "string" ? dep.repository : dep.repository?.url;

                  const lines = [
                    `${dep.name}${dep.version ? `@${dep.version}` : ""}`,
                    dep.license ? `License: ${dep.license}` : "",
                    dep.author ? `Author: ${dep.author.text()}` : "",
                    repository ? `Repository: ${repository}` : "",
                    "",
                  ];

                  if (dep.licenseText) {
                    lines.push(dep.licenseText, "");
                  }

                  lines.push("-".repeat(80), "");

                  return lines.filter((line) => line !== undefined).join("\n");
                })
                .join("\n");
            },
          },
        },
      }),
      appendSourceMappingURLPlugin(),
      ...(hasSentryAuthToken
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              release: {
                create: true,
                name: fullVersion,
                setCommits: {
                  auto: true,
                  ignoreMissing: true,
                },
                inject: true,
              },
              sourcemaps: {
                disable: true,
              },
            }),
          ]
        : []),
      sentrySourcemapsPlugin(),
    ],
  };
});

/**
 * Plugin to append //# sourceMappingURL= comments at the end of every JS asset.
 */
function appendSourceMappingURLPlugin(): Plugin {
  return {
    name: "vite-plugin-append-source-mapping-url",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith(".js") && chunk.type === "chunk" && bundle[`${fileName}.map`]) {
          const mapFileName = `${fileName.split("/").pop()}.map`;
          const comment = `\n//# sourceMappingURL=${mapFileName}`;

          // Only append if not already present
          if (!chunk.code.includes("//# sourceMappingURL=")) {
            chunk.code += comment;
          }
        }
      }
    },
  };
}

function clientTopLevelAwaitPlugin(): Plugin {
  return perEnvironmentPlugin("trizum-client-top-level-await", (environment) =>
    environment.config.consumer === "client" ? topLevelAwait() : false,
  );
}

function sentrySourcemapsPlugin(): Plugin {
  const clientDist = path.resolve(packageRoot, "dist/client");
  let sawClientBundle = false;
  let processed = false;

  return {
    name: "trizum-sentry-sourcemaps",
    apply: "build",
    enforce: "post",
    writeBundle(options) {
      if (options.dir && path.resolve(packageRoot, options.dir) === clientDist) {
        sawClientBundle = true;
      }
    },
    closeBundle() {
      if (!sawClientBundle || processed) {
        return;
      }

      processed = true;

      if (!existsSync(clientDist)) {
        throw new Error(`Expected client build output at ${clientDist}`);
      }

      runSentryCli(["sourcemaps", "inject", clientDist]);

      if (!process.env.SENTRY_AUTH_TOKEN?.trim()) {
        process.stdout.write("SENTRY_AUTH_TOKEN is not set, skipping sourcemaps upload\n");
        return;
      }

      process.stdout.write(
        `Uploading sourcemaps to Sentry for release ${fullVersion}. Org: ${sentryOrg}, Project: ${sentryProject}\n`,
      );

      runSentryCli([
        "sourcemaps",
        "upload",
        "--release",
        fullVersion,
        "--org",
        sentryOrg,
        "--project",
        sentryProject,
        clientDist,
      ]);
    },
  };
}

function runSentryCli(args: string[]) {
  execFileSync(process.execPath, [sentryCliBin, ...args], {
    cwd: packageRoot,
    env: {
      ...process.env,
      SENTRY_ORG: sentryOrg,
      SENTRY_PROJECT: sentryProject,
    },
    stdio: "inherit",
  });
}
