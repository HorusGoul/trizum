import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPrefixedIconSource,
  createSetDirectoryIconSource,
  defineIconSpriteConfig,
} from "@trizum/icon-sprite";

const require = createRequire(import.meta.url);
const lucideRoot = path.dirname(require.resolve("lucide-static/package.json"));

/** Each build target owns its outputs and scans both its source and the UI source. */
export function createUIIconSpriteConfig(usageRoots: readonly string[] = ["src"]) {
  return defineIconSpriteConfig({
    generatedSpriteFile: "src/generated/iconSprite.svg",
    generatedTypesFile: "src/generated/iconSprite.gen.ts",
    usageExcludeRoots: [fileURLToPath(new URL("../src/generated", import.meta.url))],
    usageRoots: [...usageRoots, fileURLToPath(new URL("../src", import.meta.url))],
    iconSources: [
      createPrefixedIconSource({ directory: path.join(lucideRoot, "icons"), prefix: "lucide" }),
      createSetDirectoryIconSource({
        directory: fileURLToPath(new URL("../icons", import.meta.url)),
      }),
    ],
  });
}
