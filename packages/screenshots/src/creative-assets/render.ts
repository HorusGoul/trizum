import { getLogger } from "../log.ts";
import { chromium, type Page } from "playwright";
import { build } from "vite-plus";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import assert from "node:assert/strict";
import { HEADER_DURATION, palette, type Locale } from "./data.ts";
import { renderHeaderScene } from "./header.ts";
import { normalizeArtwork } from "./svg.ts";
import { getStoreFontFaces } from "../store-design.ts";
import { renderSearchConcept, type SearchConcept } from "./search-concepts.ts";

export const CREATIVE_OUTPUT = path.resolve(import.meta.dirname, "../../creative-assets");
export const CREATIVE_LOCALES = ["en", "es"] as const;
export const STORE_LOCALE = { en: "en-US", es: "es-ES" } as const;

export const HEADER_KEYFRAMES = [
  ["zero-state", 0],
  ["ana-adds", 0.7],
  ["two-stacked", 5],
  ["three-stacked", 8.6],
  ["merge", 10],
  ["poster", 10.8],
  ["ben-pays", 11.85],
  ["cora-pays", 14.1],
  ["settled", 16.2],
  ["brand-ending", 18.6],
] as const;

async function writeFontLicense(output: string): Promise<void> {
  const font = new URL(
    import.meta.resolve("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"),
  );

  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "Inter-LICENSE.txt"),
    await readFile(new URL("../LICENSE", font)),
  );
}

export async function getCreativeFontFaces(): Promise<string> {
  const font = await readFile(
    new URL(import.meta.resolve("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")),
  );

  return `@font-face{font-family:'Trizum Inter';src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-weight:100 900;font-display:block}`;
}

async function setHeaderFrame(page: Page, seconds: number, locale: Locale): Promise<void> {
  await page.locator("#frame").evaluate(
    (element, svg) => {
      element.innerHTML = svg;
    },
    renderHeaderScene(seconds, locale),
  );
  await page.locator("#frame").evaluate(normalizeArtwork);
}

async function encodeHeader(page: Page, locale: Locale, destination: string): Promise<void> {
  const encoder = spawn(
    process.env.FFMPEG_BINARY || "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "-framerate",
      "60",
      "-i",
      "pipe:0",
      "-an",
      "-vf",
      "scale=in_range=full:out_range=tv,format=yuv420p",
      "-c:v",
      "libx264",
      "-threads",
      "2",
      "-preset",
      "fast",
      "-crf",
      "20",
      "-color_range",
      "tv",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-colorspace",
      "bt709",
      "-movflags",
      "+faststart",
      destination,
    ],
    { stdio: ["pipe", "ignore", "inherit"] },
  );

  const completed = once(encoder, "close");
  // Keep the completion rejection handled while frames are being rendered.
  void completed.catch(() => undefined);
  let streamError: Error | undefined;
  encoder.stdin.on("error", (error) => {
    streamError = error;
  });

  try {
    for (let frame = 0; frame < HEADER_DURATION * 60; frame++) {
      if (streamError) throw streamError;
      await setHeaderFrame(page, frame / 60, locale);
      const bytes = await page.screenshot({ type: "jpeg", quality: 94 });

      if (!encoder.stdin.write(bytes)) await once(encoder.stdin, "drain");

      if (frame % 300 === 0)
        getLogger("creativeAssets").info("Rendered header frames", {
          locale,
          frame,
          total: HEADER_DURATION * 60,
        });
    }

    encoder.stdin.end();
    const [code] = await completed;
    assert.equal(code, 0, "FFmpeg could not encode the header");
  } catch (error) {
    encoder.kill("SIGTERM");
    await completed.catch(() => undefined);
    throw error;
  }
}

export async function generateHeader(output = CREATIVE_OUTPUT, video = true): Promise<void> {
  await writeFontLicense(output);
  const fonts = await getCreativeFontFaces();
  const browser = await chromium.launch();

  try {
    for (const locale of CREATIVE_LOCALES) {
      const directory = path.join(output, "header", STORE_LOCALE[locale]);
      await mkdir(directory, { recursive: true });

      const page = await browser.newPage({
        viewport: { width: 3840, height: 1646 },
        deviceScaleFactor: 1,
      });

      try {
        await page.setContent(
          `<html><head><style>${fonts}html,body{margin:0;background:${palette.bg}}svg{display:block}</style></head><body><main id="frame"></main></body></html>`,
        );
        await page.evaluate(async () => {
          await document.fonts.load('900 70px "Trizum Inter"');
          await document.fonts.load('500 30px "Trizum Inter"');
        });

        for (const [name, seconds] of HEADER_KEYFRAMES) {
          await setHeaderFrame(page, seconds, locale);
          const image = await page.screenshot({ path: path.join(directory, `${name}.png`) });

          if (name === "poster") await writeFile(path.join(directory, "header.png"), image);
        }

        await setHeaderFrame(page, 0, locale);
        const first = await page.screenshot();
        await setHeaderFrame(page, HEADER_DURATION, locale);
        assert(first.equals(await page.screenshot()), "Header loop endpoints differ");

        if (video) await encodeHeader(page, locale, path.join(directory, "header.mp4"));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

export async function generateHeaderPreview(output = CREATIVE_OUTPUT): Promise<void> {
  await writeFontLicense(output);

  const bundle = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: {
        entry: path.resolve(import.meta.dirname, "preview-controls.ts"),
        formats: ["iife"],
        name: "TrizumCreative",
      },
    },
  });

  const built = Array.isArray(bundle) ? bundle[0] : bundle;

  if (!built || !("output" in built)) throw new Error("Unexpected preview bundle");
  const script = built.output.find((item) => item.type === "chunk");

  if (!script || script.type !== "chunk") throw new Error("Preview script was not built");
  const template = await readFile(path.resolve(import.meta.dirname, "preview.html"), "utf8");
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "preview.html"),
    template
      .replace("__FONT_CSS__", await getCreativeFontFaces())
      .replace("__DRAWING_SCRIPT__", () => script.code),
  );
}

export async function generateSearch(output = CREATIVE_OUTPUT): Promise<void> {
  const captures = path.resolve(import.meta.dirname, "../../.captures");
  await mkdir(output, { recursive: true });
  await writeFile(
    path.join(output, "Inter-Store-LICENSE.txt"),
    await readFile(path.resolve(import.meta.dirname, "../../../pwa/api/assets/inter/LICENSE.txt")),
  );
  const fonts = await getStoreFontFaces();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1280 },
      deviceScaleFactor: 1,
    });

    for (const locale of CREATIVE_LOCALES) {
      const images = {
        expenses: `data:image/png;base64,${(await readFile(path.join(captures, locale, "iphone-6.9/expense-log.portrait.png"))).toString("base64")}`,
        balances: `data:image/png;base64,${(await readFile(path.join(captures, locale, "iphone-6.9/balances.portrait.png"))).toString("base64")}`,
      };

      for (const concept of ["a", "b", "c"] satisfies SearchConcept[]) {
        const directory = path.join(output, "search", concept, STORE_LOCALE[locale]);
        await mkdir(directory, { recursive: true });
        const html = renderSearchConcept(concept, locale, images, fonts);
        await page.setContent(html);
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((image) => image.decode()));
        });

        const bytes = await page.screenshot({
          path: path.join(directory, "search.png"),
          animations: "disabled",
        });

        assert.equal(bytes[25], 2, "Search PNG must be RGB without alpha");
        assert.equal(bytes.readUInt32BE(16), 1920);
        assert.equal(bytes.readUInt32BE(20), 1280);
        await writeFile(path.join(directory, "search.html"), html);
      }
    }
  } finally {
    await browser.close();
  }
}
