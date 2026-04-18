import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { lingui } from "@lingui/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import license from "rollup-plugin-license";
import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { configDefaults } from "vitest/config";
import { createIconSpritePlugin } from "@trizum/icon-sprite/vite";
import iconSpriteConfig from "./iconSprite.config.mjs";
import { configurePwaLogging, getLogger } from "./src/lib/log.ts";

const ReactCompilerConfig = {};
configurePwaLogging({ lowestLevel: "info" });

const logger = getLogger("tooling", "vite");

// Read package.json version
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
) as { version: string; description: string };
const appVersion = packageJson.version;
const description = packageJson.description;

// Get git commit hash
let appCommit = "unknown";
try {
  appCommit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Git not available or not in a git repository
  logger.warning("Could not determine git commit hash");
}

const fullVersion = `${appVersion}-${appCommit}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isTest = mode === "test" || process.env.VITEST === "true";
  // Skip the Sentry Vite plugin in local/dev builds when auth is unavailable.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const hasSentryAuthToken = Boolean(sentryAuthToken);

  process.env.VITE_APP_WSS_URL =
    mode === "production"
      ? "wss://server.trizum.app/sync"
      : "wss://dev-sync.trizum.app";
  process.env.VITE_APP_VERSION = appVersion;
  process.env.VITE_APP_COMMIT = appCommit;
  process.env.VITE_APP_FULL_VERSION = fullVersion;

  return {
    build: {
      sourcemap: true,
      minify: true,
    },
    test: {
      exclude: [...configDefaults.exclude, "e2e/**"],
    },
    plugins: [
      ...(isTest ? [] : [cloudflare()]),
      tanstackRouter(),
      react(),
      babel({
        include: /\/src\/.*\.[cm]?[jt]sx?$/,
        plugins: ["@lingui/babel-plugin-lingui-macro"],
        presets: [reactCompilerPreset(ReactCompilerConfig)],
      }),
      wasm() as Plugin,
      topLevelAwait(),
      lingui(),
      createIconSpritePlugin(iconSpriteConfig),
      VitePWA({
        registerType: "prompt",
        workbox: {
          globPatterns: ["**/*.{js,wasm,css,html,svg}"],
          maximumFileSizeToCacheInBytes: 5242880,
          additionalManifestEntries: [
            { url: "/THIRD-PARTY-LICENSES.txt", revision: null },
          ],
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
            file: path.resolve(
              __dirname,
              "dist/client",
              "THIRD-PARTY-LICENSES.txt",
            ),
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
            sentryVitePlugin({
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
        if (
          fileName.endsWith(".js") &&
          chunk.type === "chunk" &&
          bundle[`${fileName}.map`]
        ) {
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
