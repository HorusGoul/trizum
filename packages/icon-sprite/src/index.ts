import fs from "node:fs";
import path from "node:path";
import { optimize } from "svgo";

export interface IconSource {
  directory: string;
  idFromRelativePath(relativePath: string, absolutePath: string): string | null;
}

export interface IconSpriteConfig {
  generatedSpriteFile: string;
  generatedTypesFile: string;
  iconSources: readonly IconSource[];
  usageFileExtensions?: readonly string[];
  usageRoots?: readonly string[];
}

export interface GenerateIconSpriteArtifactsOptions {
  config: IconSpriteConfig;
  rootDir: string;
}

export interface GenerateIconSpriteArtifactsResult {
  availableIds: string[];
  changed: boolean;
  usedIds: string[];
}

interface IconCatalogEntry {
  filePath: string;
  id: string;
}

const DEFAULT_USAGE_ROOTS = ["src"] as const;
const DEFAULT_USAGE_FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;
const STRING_LITERAL_REGEX = /(["'`])([^"'`\r\n]+)\1/g;
const SVG_ROOT_REGEX = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i;
const SVG_ATTRIBUTE_REGEX = /\b([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(["'])(.*?)\2/g;
const VIEWBOX_REGEX = /\bviewBox=(["'])([^"']+)\1/i;
const STRIPPED_SVG_ATTRIBUTES = new Set([
  "class",
  "height",
  "role",
  "width",
  "xmlns",
]);

export function defineIconSpriteConfig(config: IconSpriteConfig) {
  return config;
}

export function createPrefixedIconSource(options: {
  directory: string;
  prefix: string;
}): IconSource {
  const { directory, prefix } = options;

  return {
    directory,
    idFromRelativePath(relativePath) {
      return `${prefix}.${normalizeRelativeId(relativePath)}`;
    },
  };
}

export function createSetDirectoryIconSource(options: {
  directory: string;
}): IconSource {
  const { directory } = options;

  return {
    directory,
    idFromRelativePath(relativePath) {
      const normalizedPath = relativePath.split(path.sep).join("/");
      const [setName, ...segments] = normalizedPath
        .replace(/\.svg$/u, "")
        .split("/");

      if (!setName || segments.length === 0) {
        return null;
      }

      return `${setName}.${segments.join(".")}`;
    },
  };
}

export function generateIconSpriteArtifacts(
  options: GenerateIconSpriteArtifactsOptions,
): GenerateIconSpriteArtifactsResult {
  const { config, rootDir } = options;
  const catalog = collectIconCatalog(config, rootDir);
  const availableIds = catalog.map((entry) => entry.id);
  const usedIds = collectUsedSpriteIds(config, rootDir, availableIds);
  const spriteById = new Map(catalog.map((entry) => [entry.id, entry]));
  const typesFile = resolveFromRoot(rootDir, config.generatedTypesFile);
  const spriteFile = resolveFromRoot(rootDir, config.generatedSpriteFile);

  fs.mkdirSync(path.dirname(typesFile), { recursive: true });
  fs.mkdirSync(path.dirname(spriteFile), { recursive: true });

  const nextTypesSource = createTypesSource(availableIds);
  const nextSpriteSource = createSpriteSource(
    usedIds.map((id) => {
      const entry = spriteById.get(id);

      if (!entry) {
        throw new Error(`Missing sprite source for icon "${id}".`);
      }

      return createSymbolSource(id, entry.filePath);
    }),
  );

  const typesChanged = writeIfChanged(typesFile, nextTypesSource);
  const spriteChanged = writeIfChanged(spriteFile, nextSpriteSource);

  return {
    availableIds,
    changed: spriteChanged || typesChanged,
    usedIds,
  };
}

export function getIconSpriteGeneratedDirectories(
  config: IconSpriteConfig,
  rootDir: string,
) {
  return Array.from(
    new Set([
      path.dirname(resolveFromRoot(rootDir, config.generatedSpriteFile)),
      path.dirname(resolveFromRoot(rootDir, config.generatedTypesFile)),
    ]),
  );
}

export function getIconSpriteSourceDirectories(
  config: IconSpriteConfig,
  rootDir: string,
) {
  return config.iconSources.map((source) =>
    resolveFromRoot(rootDir, source.directory),
  );
}

export function getIconSpriteUsageRoots(
  config: IconSpriteConfig,
  rootDir: string,
) {
  return getUsageRoots(config).map((usageRoot) =>
    resolveFromRoot(rootDir, usageRoot),
  );
}

export function isIconSpriteUsageFile(
  config: IconSpriteConfig,
  filePath: string,
) {
  return getUsageFileExtensions(config).has(path.extname(filePath));
}

export function shouldRegenerateIconSprite(
  config: IconSpriteConfig,
  rootDir: string,
  filePath: string,
) {
  const resolvedFilePath = path.resolve(filePath);
  const generatedDirectories = getIconSpriteGeneratedDirectories(
    config,
    rootDir,
  );
  const sourceDirectories = getIconSpriteSourceDirectories(config, rootDir);
  const usageRoots = getIconSpriteUsageRoots(config, rootDir);

  if (
    generatedDirectories.some((directory) =>
      isPathInside(directory, resolvedFilePath),
    )
  ) {
    return false;
  }

  if (
    sourceDirectories.some((directory) =>
      isPathInside(directory, resolvedFilePath),
    ) &&
    resolvedFilePath.endsWith(".svg")
  ) {
    return true;
  }

  return (
    usageRoots.some((usageRoot) => isPathInside(usageRoot, resolvedFilePath)) &&
    isIconSpriteUsageFile(config, resolvedFilePath)
  );
}

function collectIconCatalog(config: IconSpriteConfig, rootDir: string) {
  const catalog = config.iconSources.flatMap((source) =>
    collectSourceIcons(source, rootDir),
  );

  return catalog.sort((left, right) => left.id.localeCompare(right.id));
}

function collectSourceIcons(
  source: IconSource,
  rootDir: string,
): IconCatalogEntry[] {
  const sourceDirectory = resolveFromRoot(rootDir, source.directory);

  if (!fs.existsSync(sourceDirectory)) {
    return [];
  }

  return walkFiles(sourceDirectory)
    .filter((filePath) => filePath.endsWith(".svg"))
    .flatMap((filePath) => {
      const relativePath = path.relative(sourceDirectory, filePath);
      const id = source.idFromRelativePath(relativePath, filePath);

      if (!id) {
        return [];
      }

      return [{ filePath, id }];
    });
}

function collectUsedSpriteIds(
  config: IconSpriteConfig,
  rootDir: string,
  availableIds: readonly string[],
) {
  const availableIdSet = new Set(availableIds);
  const usedIds = new Set<string>();
  const usageRoots = getIconSpriteUsageRoots(config, rootDir);
  const generatedDirectories = getIconSpriteGeneratedDirectories(
    config,
    rootDir,
  );

  for (const usageRoot of usageRoots) {
    for (const filePath of walkFiles(usageRoot)) {
      if (
        generatedDirectories.some((directory) =>
          isPathInside(directory, filePath),
        ) ||
        !isIconSpriteUsageFile(config, filePath)
      ) {
        continue;
      }

      const fileContents = fs.readFileSync(filePath, "utf8");

      for (const match of fileContents.matchAll(STRING_LITERAL_REGEX)) {
        const [, , value] = match;

        if (value && availableIdSet.has(value)) {
          usedIds.add(value);
        }
      }
    }
  }

  return Array.from(usedIds).sort((left, right) => left.localeCompare(right));
}

function walkFiles(rootDir: string) {
  const queue = [rootDir];
  const files: string[] = [];

  while (queue.length > 0) {
    const currentDir = queue.pop();

    if (!currentDir || !fs.existsSync(currentDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function createTypesSource(availableIds: readonly string[]) {
  const quotedIds = availableIds.map((id) => `  "${id}"`).join(",\n");

  return `/* eslint-disable */
// This file is auto-generated by the icon sprite tooling.

export const spriteIds = [
${quotedIds}
] as const;

export type SpriteId = (typeof spriteIds)[number];
`;
}

function createSpriteSource(symbols: readonly string[]) {
  const contents = symbols.length > 0 ? `\n${symbols.join("\n")}\n` : "\n";

  return `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${contents}</svg>\n`;
}

function createSymbolSource(id: string, filePath: string) {
  const source = fs.readFileSync(filePath, "utf8");
  const optimized = optimize(source, {
    multipass: true,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false,
          },
        },
      },
      "removeDimensions",
      "removeTitle",
      "removeDesc",
    ],
  });

  if ("error" in optimized) {
    throw new Error(
      `Failed to optimize icon "${id}" from ${filePath}: ${String(optimized.error)}`,
    );
  }

  const svgMatch = optimized.data.match(SVG_ROOT_REGEX);

  if (!svgMatch) {
    throw new Error(`Could not parse optimized SVG for icon "${id}".`);
  }

  const [, rawAttributes, rawInnerContent] = svgMatch;
  const innerContent = rawInnerContent.trim();
  const viewBox = rawAttributes.match(VIEWBOX_REGEX)?.[2] ?? "0 0 24 24";
  const symbolAttributes = new Map<string, string>();

  for (const attributeMatch of rawAttributes.matchAll(SVG_ATTRIBUTE_REGEX)) {
    const [, name, , value] = attributeMatch;

    if (name === "viewBox" || STRIPPED_SVG_ATTRIBUTES.has(name)) {
      continue;
    }

    symbolAttributes.set(name, value);
  }

  const hasPresentationAttributes =
    Array.from(symbolAttributes.keys()).some(
      (name) => name === "fill" || name === "stroke",
    ) || /\b(?:fill|stroke)=["']/u.test(innerContent);

  if (!hasPresentationAttributes) {
    symbolAttributes.set("fill", "currentColor");
  }

  const renderedAttributes = Array.from(symbolAttributes.entries())
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(" ");
  const trailingAttributes = renderedAttributes ? ` ${renderedAttributes}` : "";

  return `  <symbol id="${escapeAttribute(id)}" viewBox="${escapeAttribute(viewBox)}"${trailingAttributes}>${innerContent}</symbol>`;
}

function writeIfChanged(filePath: string, nextContents: string) {
  const previousContents = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : null;

  if (previousContents === nextContents) {
    return false;
  }

  fs.writeFileSync(filePath, nextContents, "utf8");

  return true;
}

function getUsageRoots(config: IconSpriteConfig) {
  return config.usageRoots ?? DEFAULT_USAGE_ROOTS;
}

function getUsageFileExtensions(config: IconSpriteConfig) {
  return new Set(config.usageFileExtensions ?? DEFAULT_USAGE_FILE_EXTENSIONS);
}

function normalizeRelativeId(relativePath: string) {
  return relativePath
    .replace(/\.svg$/u, "")
    .split(path.sep)
    .join(".");
}

function resolveFromRoot(rootDir: string, filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath);
}

function isPathInside(rootDir: string, targetPath: string) {
  const relativePath = path.relative(rootDir, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
