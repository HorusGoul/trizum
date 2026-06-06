import type { Plugin } from "vite-plus";
import { defineConfig, lazyPlugins } from "vite-plus";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { getConfig as getLinguiConfig } from "@lingui/conf";
import type { AcceptedPlugin as PostcssPlugin } from "postcss";
import { configDefaults } from "vite-plus";
import { createIconSpritePlugin } from "../icon-sprite/src/vite";
import iconSpriteConfig from "./iconSprite.config.mjs";

const ReactCompilerConfig = {};
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const packageRequire = createRequire(new URL("package.json", import.meta.url));
const tailwindConfigPath = path.resolve(packageRoot, "tailwind.config.js");
const tailwindcss = packageRequire("tailwindcss") as (options: { config: string }) => PostcssPlugin;
const autoprefixer = packageRequire("autoprefixer") as () => PostcssPlugin;
const linguiConfigPath = path.resolve(packageRoot, "lingui.config.ts");
const linguiConfig = getLinguiConfig({
  cwd: packageRoot,
  configPath: linguiConfigPath,
});
const linguiBabelPlugin = packageRequire.resolve("@lingui/babel-plugin-lingui-macro");
const reactCompilerBabelPlugin = packageRequire.resolve("babel-plugin-react-compiler");
const reactCompilerPreset = {
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
};

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
  // Skip the Sentry Vite plugin in local/dev builds when auth is unavailable.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const hasSentryAuthToken = Boolean(sentryAuthToken);

  process.env.VITE_APP_WSS_URL =
    mode === "production" ? "wss://server.trizum.app/sync" : "wss://dev-sync.trizum.app";
  process.env.VITE_APP_VERSION = appVersion;
  process.env.VITE_APP_COMMIT = appCommit;
  process.env.VITE_APP_FULL_VERSION = fullVersion;

  return {
    build: {
      sourcemap: true,
      minify: true,
    },
    css: {
      postcss: {
        plugins: [tailwindcss({ config: tailwindConfigPath }), autoprefixer()],
      },
    },
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
    },
    plugins: lazyPlugins(async () => {
      const [
        cloudflareModule,
        reactModule,
        babelModule,
        tanstackRouterModule,
        wasmModule,
        topLevelAwaitModule,
        linguiModule,
        pwaModule,
        licenseModule,
        sentryModule,
      ] = await Promise.all([
        import("@cloudflare/vite-plugin"),
        import("@vitejs/plugin-react"),
        import("@rolldown/plugin-babel"),
        import("@tanstack/router-plugin/vite"),
        import("vite-plugin-wasm"),
        import("vite-plugin-top-level-await"),
        import("@lingui/vite-plugin"),
        import("vite-plugin-pwa"),
        import("rollup-plugin-license"),
        import("@sentry/vite-plugin"),
      ]);

      const react = reactModule.default;
      const babel = babelModule.default;
      const wasm = wasmModule.default;
      const topLevelAwait = topLevelAwaitModule.default;
      const license = licenseModule.default;

      return [
        ...(isTest ? [] : [cloudflareModule.cloudflare()]),
        tanstackRouterModule.tanstackRouter(),
        react(),
        babel({
          include: /\/src\/.*\.[cm]?[jt]sx?$/,
          plugins: [[linguiBabelPlugin, { linguiConfig }]],
          presets: [reactCompilerPreset],
        }),
        wasm() as Plugin,
        topLevelAwait(),
        linguiModule.lingui({
          cwd: packageRoot,
          configPath: linguiConfigPath,
        }),
        createIconSpritePlugin(iconSpriteConfig),
        pwaModule.VitePWA({
          registerType: "prompt",
          workbox: {
            globPatterns: ["**/*.{js,wasm,css,html,svg}"],
            maximumFileSizeToCacheInBytes: 5242880,
            additionalManifestEntries: [{ url: "/THIRD-PARTY-LICENSES.txt", revision: null }],
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
                      typeof dep.repository === "object" && dep.repository?.url
                        ? dep.repository.url
                        : dep.repository;

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
              sentryModule.sentryVitePlugin({
                org: process.env.SENTRY_ORG,
                project: process.env.SENTRY_PROJECT,
                authToken: sentryAuthToken,
                release: {
                  create: true,
                  name: fullVersion,
                  setCommits: {
                    auto: true,
                  },
                  inject: true,
                },
                sourcemaps: {
                  disable: true,
                },
              }),
            ]
          : []),
      ];
    }),
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
