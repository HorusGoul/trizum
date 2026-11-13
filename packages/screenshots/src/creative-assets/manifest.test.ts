import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  inspectCreative,
  posterSeconds,
  prepareCreativeAssets,
  validateCreativeManifest,
  type CreativeManifest,
} from "./manifest.ts";

function png(width: number, height: number, alpha = false, color = 0): Buffer {
  const chunk = (type: string, bytes: Buffer): Buffer => {
    const content = Buffer.concat([Buffer.from(type), bytes]),
      length = Buffer.alloc(4),
      checksum = Buffer.alloc(4);

    length.writeUInt32BE(bytes.length);
    checksum.writeUInt32BE(crc32(content));

    return Buffer.concat([length, content, checksum]);
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = alpha ? 6 : 2;

  const pixels = Buffer.alloc(height * (1 + width * (alpha ? 4 : 3)), color);

  for (let row = 0; row < height; row++) pixels[row * (1 + width * (alpha ? 4 : 3))] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "trizum-creatives-test-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function selectedHeader(): Promise<string> {
  const file = path.join(directory, "selected/manifest.json"),
    bytes = png(3840, 1646);

  const manifest: CreativeManifest = { app_identifier: "app.trizum.capacitor", assets: [] };

  for (const locale of ["en-US", "es-ES"]) {
    await mkdir(path.join(directory, "selected", locale), { recursive: true });
    await writeFile(path.join(directory, "selected", locale, "header.png"), bytes);
    manifest.assets.push({
      locale,
      path: `${locale}/header.png`,
      placement_type: "PRODUCT_PAGE_HEADER_ASSET",
      media_type: "image",
      width: 3840,
      height: 1646,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  await writeFile(file, JSON.stringify(manifest));

  return file;
}

async function searchDraft(locales = ["en-US", "es-ES"]): Promise<string> {
  const draft = path.join(directory, "draft");

  for (const locale of locales) {
    await mkdir(path.join(draft, locale), { recursive: true });
    await writeFile(path.join(draft, locale, "search.png"), png(1920, 1280));
  }

  return draft;
}

describe("creative release selection", () => {
  it("adds reviewed search images without replacing the selected headers", async () => {
    const manifest = await selectedHeader(),
      before = await readFile(manifest, "utf8");

    await prepareCreativeAssets("search", await searchDraft(), "image", undefined, manifest);
    const after = await validateCreativeManifest(manifest);
    expect(after.assets).toHaveLength(4);
    expect(
      after.assets.filter((asset) => asset.placement_type === "PRODUCT_PAGE_HEADER_ASSET"),
    ).toEqual(JSON.parse(before).assets);
    expect(
      after.assets
        .filter((asset) => asset.placement_type === "APP_STORE_SEARCH_RESULTS_ASSET")
        .map((asset) => asset.locale),
    ).toEqual(["en-US", "es-ES"]);
    await prepareCreativeAssets("search", await searchDraft(), "image", undefined, manifest);
    expect((await validateCreativeManifest(manifest)).assets).toHaveLength(4);
  });

  it("leaves release selection unchanged if a locale is missing", async () => {
    const manifest = await selectedHeader(),
      before = await readFile(manifest);

    await expect(
      prepareCreativeAssets("search", await searchDraft(["en-US"]), "image", undefined, manifest),
    ).rejects.toThrow(/ENOENT/);
    expect(await readFile(manifest)).toEqual(before);
  });

  it("rejects alpha PNGs and incorrect placement dimensions", async () => {
    const file = path.join(directory, "search.png");
    await writeFile(file, png(1920, 1280, true));
    await expect(inspectCreative(file, "search")).rejects.toThrow("without an alpha");
    await writeFile(file, png(1920, 1280));
    await expect(inspectCreative(file, "header")).rejects.toThrow("3840×1646");
    expect((await inspectCreative(file, "search")).media_type).toBe("image");
  });

  it("detects selected file changes after approval", async () => {
    const manifest = await selectedHeader();
    await writeFile(path.join(directory, "selected/en-US/header.png"), png(3840, 1646, false, 1));
    await expect(validateCreativeManifest(manifest)).rejects.toThrow("sha256");
  });

  it("validates frame-based poster times against video duration and frame rate", () => {
    expect(posterSeconds("00:00:10:48", 60, 20)).toBe(10.8);
    expect(() => posterSeconds("00:00:10:48", 30, 20)).toThrow("outside");
    expect(() => posterSeconds("00:00:20:00", 60, 20)).toThrow("outside");
    expect(() => posterSeconds("10.8", 60, 20)).toThrow("HH:MM:SS:FF");
  });
});
