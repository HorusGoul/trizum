import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lucideStaticRoot = path.dirname(require.resolve("lucide-static/package.json"));

export default {
  generatedSpriteFile: "src/generated/iconSprite.svg",
  generatedTypesFile: "src/generated/iconSprite.gen.ts",
  iconSources: [
    {
      directory: path.join(lucideStaticRoot, "icons"),
      idFromRelativePath(relativePath) {
        return `lucide.${normalizeRelativeId(relativePath)}`;
      },
    },
    {
      directory: "src/icons",
      idFromRelativePath(relativePath) {
        const normalizedPath = relativePath.split(path.sep).join("/");
        const [setName, ...segments] = normalizedPath.replace(/\.svg$/u, "").split("/");

        if (!setName || segments.length === 0) {
          return null;
        }

        return `${setName}.${segments.join(".")}`;
      },
    },
  ],
};

function normalizeRelativeId(relativePath) {
  return relativePath
    .replace(/\.svg$/u, "")
    .split(path.sep)
    .filter(Boolean)
    .join(".");
}
