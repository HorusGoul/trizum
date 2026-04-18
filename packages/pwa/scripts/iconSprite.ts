import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { optimize } from "svgo";

export const GENERATED_ICON_TYPES_FILE = "src/generated/iconSprite.gen.ts";
export const GENERATED_ICON_SPRITE_FILE = "src/generated/iconSprite.svg";

const CUSTOM_ICON_SETS_DIR = "src/icons";
const GENERATED_DIR = "src/generated";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
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

const require = createRequire(import.meta.url);
const lucideStaticRoot = path.dirname(require.resolve("lucide-static/package.json"));
const lucideStaticIconsDir = path.join(lucideStaticRoot, "icons");

interface IconCatalogEntry {
  filePath: string;
  id: string;
}

export function generateIconSpriteArtifacts(packageDir: string) {
  const catalog = collectIconCatalog(packageDir);
  const availableIds = catalog.map((entry) => entry.id);
  const usedIds = collectUsedSpriteIds(packageDir, availableIds);
  const spriteById = new Map(catalog.map((entry) => [entry.id, entry]));

  const typesFile = path.join(packageDir, GENERATED_ICON_TYPES_FILE);
  const spriteFile = path.join(packageDir, GENERATED_ICON_SPRITE_FILE);

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

function collectIconCatalog(packageDir: string) {
  const catalog = [
    ...collectLucideIcons(),
    ...collectCustomIcons(path.join(packageDir, CUSTOM_ICON_SETS_DIR)),
  ];

  return catalog.sort((left, right) => left.id.localeCompare(right.id));
}

function collectLucideIcons(): IconCatalogEntry[] {
  return fs
    .readdirSync(lucideStaticIconsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => ({
      filePath: path.join(lucideStaticIconsDir, entry.name),
      id: `lucide.${entry.name.replace(/\.svg$/u, "")}`,
    }));
}

function collectCustomIcons(customIconsDir: string): IconCatalogEntry[] {
  if (!fs.existsSync(customIconsDir)) {
    return [];
  }

  const customSets = fs
    .readdirSync(customIconsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  return customSets.flatMap((setEntry) => {
    const setRoot = path.join(customIconsDir, setEntry.name);

    return walkFiles(setRoot)
      .filter((filePath) => filePath.endsWith(".svg"))
      .map((filePath) => {
        const relativePath = path.relative(setRoot, filePath).replace(/\.svg$/u, "");
        const normalizedName = relativePath.split(path.sep).join(".");

        return {
          filePath,
          id: `${setEntry.name}.${normalizedName}`,
        };
      });
  });
}

function collectUsedSpriteIds(packageDir: string, availableIds: readonly string[]) {
  const availableIdSet = new Set(availableIds);
  const sourceRoot = path.join(packageDir, "src");
  const usedIds = new Set<string>();

  for (const filePath of walkFiles(sourceRoot)) {
    if (filePath.includes(`${path.sep}${GENERATED_DIR}${path.sep}`)) {
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }

    const fileContents = fs.readFileSync(filePath, "utf8");

    for (const match of fileContents.matchAll(STRING_LITERAL_REGEX)) {
      const [, , value] = match;

      if (availableIdSet.has(value)) {
        usedIds.add(value);
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
      `Failed to optimize icon "${id}" from ${filePath}: ${optimized.error}`,
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

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
