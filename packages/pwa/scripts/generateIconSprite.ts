import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateIconSpriteArtifacts } from "./iconSprite.ts";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(currentDir, "..");

generateIconSpriteArtifacts(packageDir);
