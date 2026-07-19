import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ANDROID_SPLASH_ICON_SIZE_DP = 288;
const SOURCE_ICON_VIEWPORT_SIZE = 512;
const ANDROID_SPLASH_ICON_VIEWPORT_SIZE = 576;
const ANDROID_SPLASH_ICON_INSET =
  (ANDROID_SPLASH_ICON_VIEWPORT_SIZE - SOURCE_ICON_VIEWPORT_SIZE) / 2;

type SvgAttributes = Record<string, string>;

function parseAttributes(source: string, elementName: string): SvgAttributes {
  const attributes: SvgAttributes = {};
  const attributePattern = /([\w:-]+)="([^"]*)"/g;

  for (const match of source.matchAll(attributePattern)) {
    const [, name, value] = match;
    if (!name || value === undefined) {
      continue;
    }
    attributes[name] = value;
  }

  const unsupportedSyntax = source.replace(attributePattern, "").trim();
  if (unsupportedSyntax) {
    throw new Error(`${elementName} contains unsupported attribute syntax: ${unsupportedSyntax}`);
  }

  return attributes;
}

function assertAttributes(elementName: string, attributes: SvgAttributes, supported: string[]) {
  const unsupported = Object.keys(attributes).filter((attribute) => !supported.includes(attribute));
  if (unsupported.length > 0) {
    throw new Error(`${elementName} contains unsupported attributes: ${unsupported.join(", ")}`);
  }
}

function assertAttribute(
  elementName: string,
  attributes: SvgAttributes,
  attributeName: string,
  expectedValue: string,
) {
  const actualValue = attributes[attributeName];
  if (actualValue !== expectedValue) {
    throw new Error(
      `${elementName} must have ${attributeName}="${expectedValue}", received ${JSON.stringify(actualValue)}`,
    );
  }
}

function escapeXmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function generateAndroidSplashIcon(svgSource: string) {
  const normalizedSource = svgSource.replaceAll(/<!--[\s\S]*?-->/g, "").trim();
  const match = normalizedSource.match(
    /^<svg(?<svgAttributes>[^>]*)>\s*<rect(?<rectAttributes>[^>]*)\/>\s*<path(?<pathAttributes>[^>]*)\/>\s*<\/svg>$/,
  );

  if (!match?.groups) {
    throw new Error("Logo SVG must contain exactly one background rect followed by one path");
  }

  const svgAttributes = parseAttributes(match.groups.svgAttributes, "svg");
  const rectAttributes = parseAttributes(match.groups.rectAttributes, "rect");
  const pathAttributes = parseAttributes(match.groups.pathAttributes, "path");

  assertAttributes("svg", svgAttributes, ["width", "height", "viewBox", "fill", "xmlns"]);
  assertAttribute("svg", svgAttributes, "width", "512");
  assertAttribute("svg", svgAttributes, "height", "512");
  assertAttribute("svg", svgAttributes, "viewBox", "0 0 512 512");
  assertAttribute("svg", svgAttributes, "fill", "none");
  assertAttribute("svg", svgAttributes, "xmlns", "http://www.w3.org/2000/svg");

  assertAttributes("rect", rectAttributes, ["width", "height", "fill"]);
  assertAttribute("rect", rectAttributes, "width", "512");
  assertAttribute("rect", rectAttributes, "height", "512");
  assertAttribute("rect", rectAttributes, "fill", "black");

  assertAttributes("path", pathAttributes, ["d", "stroke", "stroke-width", "stroke-linecap"]);
  assertAttribute("path", pathAttributes, "stroke", "white");
  assertAttribute("path", pathAttributes, "stroke-linecap", "round");

  const pathData = pathAttributes.d;
  if (!pathData) {
    throw new Error("Logo path must contain path data");
  }

  const strokeWidth = Number(pathAttributes["stroke-width"]);
  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    throw new Error("Logo path stroke-width must be a positive number");
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from packages/pwa/public/maskable.svg by the mobile asset generator. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${ANDROID_SPLASH_ICON_SIZE_DP}dp"
    android:height="${ANDROID_SPLASH_ICON_SIZE_DP}dp"
    android:viewportWidth="${ANDROID_SPLASH_ICON_VIEWPORT_SIZE}"
    android:viewportHeight="${ANDROID_SPLASH_ICON_VIEWPORT_SIZE}">
    <group
        android:translateX="${ANDROID_SPLASH_ICON_INSET}"
        android:translateY="${ANDROID_SPLASH_ICON_INSET}">
        <path
            android:fillColor="#00000000"
            android:pathData="${escapeXmlAttribute(pathData)}"
            android:strokeColor="#FFFFFFFF"
            android:strokeLineCap="round"
            android:strokeWidth="${strokeWidth}" />
    </group>
</vector>
`;
}

async function run() {
  const packageDirectory = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
  const sourcePath = path.resolve(packageDirectory, "../pwa/public/maskable.svg");
  const outputPath = path.resolve(
    packageDirectory,
    "android/app/src/main/res/drawable/splash_icon.xml",
  );
  const checkOnly = process.argv.slice(2).includes("--check");
  const source = await readFile(sourcePath, "utf8");
  const generated = generateAndroidSplashIcon(source);

  if (checkOnly) {
    const existing = await readFile(outputPath, "utf8").catch(() => "");
    if (existing !== generated) {
      throw new Error(
        "Android splash icon is out of date. Run `vp run --filter @trizum/mobile assets:generate`.",
      );
    }
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated);
}

const executedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedPath === import.meta.url) {
  await run();
}
