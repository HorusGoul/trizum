import { readFile, writeFile, copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type CreativeKind = "header" | "search";

export type { CreativeAsset, CreativeManifest } from "./schema.ts";

import {
  creativeManifestSchema,
  videoProbeSchema,
  type CreativeAsset,
  type CreativeManifest,
} from "./schema.ts";

export const RELEASE_DIRECTORY = path.resolve(
  import.meta.dirname,
  "../../../mobile/ios/App/fastlane/creative_assets",
);

export const RELEASE_MANIFEST = path.join(RELEASE_DIRECTORY, "manifest.json");
const execute = promisify(execFile);

const placementTypes = {
  header: "PRODUCT_PAGE_HEADER_ASSET",
  search: "APP_STORE_SEARCH_RESULTS_ASSET",
} as const;

const storeLocales = ["en-US", "es-ES"] as const;

async function inspectVideo(
  file: string,
): Promise<Pick<CreativeAsset, "width" | "height" | "fps" | "duration">> {
  const { stdout } = await execute(process.env.FFPROBE_BINARY || "ffprobe", [
    "-v",
    "error",
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    file,
  ]);

  const metadata = videoProbeSchema.parse(JSON.parse(stdout));
  const stream = metadata.streams[0];
  const [numerator, denominator] = stream.r_frame_rate.split("/").map(Number);

  const fps = numerator / denominator,
    duration = Number(metadata.format.duration);

  if (![30, 60].includes(fps) || !Number.isFinite(duration) || duration < 5 || duration > 30)
    throw new Error("Creative videos require 30/60 fps and 5–30 seconds");

  return { width: stream.width, height: stream.height, fps, duration };
}

export async function inspectCreative(
  file: string,
  kind: CreativeKind,
): Promise<Omit<CreativeAsset, "locale" | "path">> {
  const bytes = await readFile(file),
    sha256 = createHash("sha256").update(bytes).digest("hex"),
    extension = path.extname(file).toLowerCase();

  let dimensions: Pick<CreativeAsset, "width" | "height">;
  let video: Pick<CreativeAsset, "fps" | "duration"> | undefined;
  let media_type: CreativeAsset["media_type"];

  if (extension === ".png") {
    if (
      bytes.length < 33 ||
      !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes[25] !== 2
    )
      throw new Error("Creative PNGs must be RGB without an alpha channel");
    dimensions = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    media_type = "image";
  } else if (extension === ".mp4") {
    const inspected = await inspectVideo(file);
    dimensions = { width: inspected.width, height: inspected.height };
    video = { fps: inspected.fps, duration: inspected.duration };
    media_type = "video";
  } else {
    throw new Error("Select an RGB PNG or silent H.264 MP4");
  }

  if (kind === "header" && (dimensions.width !== 3840 || dimensions.height !== 1646))
    throw new Error("Header dimensions must be 3840×1646");

  if (
    kind === "search" &&
    (dimensions.width < 1920 ||
      dimensions.width > 3840 ||
      dimensions.height * 3 !== dimensions.width * 2)
  )
    throw new Error("Search artwork must be 3:2, from 1920×1280 to 3840×2560");

  return { placement_type: placementTypes[kind], media_type, ...dimensions, ...video, sha256 };
}

export function posterSeconds(timecode: string, fps: number, duration: number): number {
  const match = /^(\d{2}):([0-5]\d):([0-5]\d):(\d{2})$/.exec(timecode);

  if (!match) throw new Error("Poster timecode must be HH:MM:SS:FF");
  const [, hours, minutes, seconds, frames] = match.map(Number);
  const time = hours * 3600 + minutes * 60 + seconds + frames / fps;

  if (frames >= fps || !Number.isFinite(time) || time >= duration)
    throw new Error("Poster timecode falls outside the video");

  return time;
}

export async function validateCreativeManifest(
  manifestPath = RELEASE_MANIFEST,
): Promise<CreativeManifest> {
  const manifest = creativeManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));

  if (manifest.app_identifier !== "app.trizum.capacitor" || !manifest.assets.length)
    throw new Error("Invalid or empty creative asset manifest");
  const targets = new Set<string>();

  for (const asset of manifest.assets) {
    const target = `${asset.locale}/${asset.placement_type}`;

    if (targets.has(target)) throw new Error(`Duplicate creative target: ${target}`);
    targets.add(target);
    const kind = asset.placement_type === placementTypes.header ? "header" : "search";

    const actual = await inspectCreative(
      path.resolve(path.dirname(manifestPath), asset.path),
      kind,
    );

    for (const key of [
      "sha256",
      "placement_type",
      "media_type",
      "width",
      "height",
      "fps",
      "duration",
    ] as const) {
      if (actual[key] !== undefined && asset[key] !== actual[key])
        throw new Error(`Selected asset differs from its manifest: ${target} / ${key}`);
    }

    if (asset.media_type === "video") {
      if (asset.fps === undefined || asset.duration === undefined || !asset.preview_frame_time_code)
        throw new Error("Selected video needs metadata and a poster timecode");
      posterSeconds(asset.preview_frame_time_code, asset.fps, asset.duration);
    }
  }

  return manifest;
}

export async function prepareCreativeAssets(
  kind: CreativeKind,
  from: string,
  media: CreativeAsset["media_type"],
  posterTimecode?: string,
  manifestPath = RELEASE_MANIFEST,
): Promise<void> {
  if (media === "video" && !posterTimecode)
    throw new Error("Video selection requires --poster-time-code");

  const directory = path.dirname(manifestPath),
    current = creativeManifestSchema.parse(JSON.parse(await readFile(manifestPath, "utf8")));

  // Inspect every locale before changing any release files.
  const selections = await Promise.all(
    storeLocales.map(async (locale) => {
      const source = path.resolve(from, locale, `${kind}.${media === "video" ? "mp4" : "png"}`),
        metadata = await inspectCreative(source, kind);

      if (metadata.media_type !== media)
        throw new Error("Selected media type differs from its file");

      const asset: CreativeAsset = {
        locale,
        path: `${locale}/${path.basename(source)}`,
        ...metadata,
      };

      if (media === "video") {
        if (!posterTimecode || metadata.fps === undefined || metadata.duration === undefined)
          throw new Error("Video poster metadata is required");
        posterSeconds(posterTimecode, metadata.fps, metadata.duration);
        asset.preview_frame_time_code = posterTimecode;
      }

      return { source, asset };
    }),
  );

  const staging = await mkdtemp(path.join(tmpdir(), "trizum-creatives-"));

  try {
    for (const selection of selections) {
      if (media === "video") {
        const seconds = posterSeconds(
          selection.asset.preview_frame_time_code || "",
          selection.asset.fps || 0,
          selection.asset.duration || 0,
        );

        await execute(process.env.FFMPEG_BINARY || "ffmpeg", [
          "-y",
          "-v",
          "error",
          "-ss",
          String(seconds),
          "-i",
          selection.source,
          "-frames:v",
          "1",
          "-vf",
          "format=rgb24",
          path.join(staging, `${selection.asset.locale}.png`),
        ]);
      }
    }

    for (const selection of selections) {
      const destination = path.join(directory, selection.asset.path);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(selection.source, destination);

      if (media === "video")
        await copyFile(
          path.join(staging, `${selection.asset.locale}.png`),
          path.join(path.dirname(destination), `${kind}-poster.png`),
        );
    }

    const assets = [
      ...current.assets.filter(
        (asset) =>
          asset.placement_type !== placementTypes[kind] ||
          !storeLocales.some((locale) => locale === asset.locale),
      ),
      ...selections.map((selection) => selection.asset),
    ];

    await writeFile(manifestPath, JSON.stringify({ ...current, assets }, null, 2) + "\n");
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
