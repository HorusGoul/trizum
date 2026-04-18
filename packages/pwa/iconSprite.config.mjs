import path from "node:path";
import { createRequire } from "node:module";
import {
  createPrefixedIconSource,
  createSetDirectoryIconSource,
  defineIconSpriteConfig,
} from "@trizum/icon-sprite";

const require = createRequire(import.meta.url);
const lucideStaticRoot = path.dirname(require.resolve("lucide-static/package.json"));

export default defineIconSpriteConfig({
  generatedSpriteFile: "src/generated/iconSprite.svg",
  generatedTypesFile: "src/generated/iconSprite.gen.ts",
  iconSources: [
    createPrefixedIconSource({
      directory: path.join(lucideStaticRoot, "icons"),
      prefix: "lucide",
    }),
    createSetDirectoryIconSource({
      directory: "src/icons",
    }),
  ],
});
