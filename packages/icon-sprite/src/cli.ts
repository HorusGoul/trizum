import path from "node:path";
import { pathToFileURL } from "node:url";
import { generateIconSpriteArtifacts, type IconSpriteConfig } from "./index.js";

interface IconSpriteConfigModule {
  default?: IconSpriteConfig;
  iconSpriteConfig?: IconSpriteConfig;
}

async function main() {
  const configPath = process.argv[2];

  if (!configPath) {
    throw new Error("Missing icon sprite config path.");
  }

  const resolvedConfigPath = path.resolve(process.cwd(), configPath);
  const moduleUrl = pathToFileURL(resolvedConfigPath).href;
  const importedModule = (await import(moduleUrl)) as IconSpriteConfigModule;
  const config = importedModule.default ?? importedModule.iconSpriteConfig;

  if (!config) {
    throw new Error(
      `The config module "${configPath}" must export a default config or "iconSpriteConfig".`,
    );
  }

  generateIconSpriteArtifacts({
    config,
    rootDir: path.dirname(resolvedConfigPath),
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}
