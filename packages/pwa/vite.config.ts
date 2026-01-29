import type { Plugin } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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

const ReactCompilerConfig = {};

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
  console.warn("Could not determine git commit hash");
}

const fullVersion = `${appVersion}-${appCommit}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  process.env.VITE_APP_WSS_URL =
    mode === "production"
      ? "wss://server.trizum.app/sync"
      : "wss://dev-sync.trizum.app";
  process.env.VITE_APP_API_URL =
    mode === "production"
      ? "https://trizum.app"
      : "http://localhost:5173";
  process.env.VITE_APP_VERSION = appVersion;
  process.env.VITE_APP_COMMIT = appCommit;
  process.env.VITE_APP_FULL_VERSION = fullVersion;

  return {
    build: {
      sourcemap: true,
      minify: true,
    },
    plugins: [
      cloudflare(),
      tanstackRouter(),
      react({
        babel: {
          plugins: [
            "@lingui/babel-plugin-lingui-macro",
            ["babel-plugin-react-compiler", ReactCompilerConfig],
          ],
        },
      }),
      wasm() as Plugin,
      topLevelAwait(),
      lingui(),
      preloadIconsPlugin({
        matchers: [/#lucide\/([^"'`]+)/g],
        importPreloadFunction: `import { preloadIcon } from "#src/ui/Icon.js";`,
        preloadFunctionName: "preloadIcon",
      }),
      VitePWA({
        registerType: "prompt",
        workbox: {
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
      // Plugin to read preloaded icons and configure externals
      excludeUnusedLucideIconsPlugin(),
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
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
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

interface PreloadIconsPluginOptions {
  matchers: RegExp[];
  importPreloadFunction: string;
  preloadFunctionName: string;

  /**
   * @default "src/preloadIcons.gen.ts"
   */
  outFile?: string;
}

function preloadIconsPlugin({
  matchers,
  importPreloadFunction,
  preloadFunctionName,
  outFile = "src/preloadIcons.gen.ts",
}: PreloadIconsPluginOptions): Plugin {
  const matches = new Set<string>();
  const compile = debounce(() => void writeFile(), 1000);

  function debounce(fn: () => void, ms: number) {
    let timeout: NodeJS.Timeout;

    return () => {
      clearTimeout(timeout);
      timeout = setTimeout(fn, ms);
    };
  }

  let prev = "";

  async function writeFile() {
    const sorted = Array.from(matches).sort();
    const joined = sorted.join();

    if (prev === joined) {
      return;
    }

    prev = joined;

    const code = `/* prettier-ignore-start */
/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols
// This file is auto-generated by vite-plugin-preload-icons

${importPreloadFunction}

export function preloadAllIcons() {
  return Promise.all([
    ${sorted.map((match) => `${preloadFunctionName}("${match}")`).join(",\n")}
  ])
}
  
/* prettier-ignore-end */`;

    const fs = await import("node:fs/promises");

    await fs.writeFile(outFile, code, "utf-8");
  }

  let isDev = false;

  return {
    name: "vite-plugin-preload-icons",

    configResolved(config) {
      isDev = config.command !== "build";
    },

    transform(code, id) {
      if (!isDev) {
        return;
      }

      const scanForIcons = id.includes(".ts") || id.includes(".tsx");

      if (id.includes(outFile) || !scanForIcons) {
        return;
      }

      for (const matcher of matchers) {
        const regexResult = code.match(matcher);

        if (regexResult) {
          regexResult.forEach((match) => {
            matches.add(match);
          });

          compile();
        }
      }
    },
  };
}

function excludeUnusedLucideIconsPlugin(): Plugin {
  let usedIcons: Set<string> | null = null;

  return {
    name: "vite-plugin-exclude-unused-lucide-icons",
    async configResolved(config) {
      // Read the generated preload icons file at config resolution
      if (config.command !== "build") return;

      const fs = await import("node:fs");
      const path = await import("node:path");
      const root = process.cwd();
      const preloadFile = path.default.resolve(root, "src/preloadIcons.gen.ts");

      if (fs.default.existsSync(preloadFile)) {
        const content = fs.default.readFileSync(preloadFile, "utf-8");
        const iconMatches =
          content.match(/preloadIcon\(["']#lucide\/([^"']+)["']\)/g) || [];
        const allowedIcons = iconMatches.map((match: string) =>
          match.replace(/preloadIcon\(["']#lucide\/([^"']+)["']\)/, "$1"),
        );

        usedIcons = new Set(allowedIcons);
      }
    },

    transform(code, id) {
      // Intercept lucide-react/dynamicIconImports to filter it
      if (id.includes("dynamicIconImports") && id.includes("lucide-react")) {
        if (!usedIcons || usedIcons.size === 0) return null;

        // Parse the file to filter out unused icons
        // The file structure is: const dynamicIconImports = { ... }; export default dynamicIconImports;

        // Extract the object content
        const constRegex = /const\s+dynamicIconImports\s*=\s*\{([\s\S]*?)\};/;
        const match = code.match(constRegex);

        if (!match) return null;

        const entries = match[1];
        const entryRegex =
          /"([a-zA-Z0-9_-]+)":\s*\(\)\s*=>\s*import\(['"]([^"']+)['"]\)/g;
        const keptEntries: string[] = [];
        let m;

        while ((m = entryRegex.exec(entries)) !== null) {
          const iconName = m[1];
          const importPath = m[2];

          if (usedIcons.has(iconName)) {
            keptEntries.push(`  "${iconName}": () => import("${importPath}")`);
          }
        }

        // Reconstruct the file with only kept entries
        const newCode = code.replace(
          constRegex,
          `const dynamicIconImports = {\n${keptEntries.join(",\n")}\n};`,
        );

        return { code: newCode, map: null };
      }

      return null;
    },
  };
}
