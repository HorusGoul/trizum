import { chromium } from "playwright";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURE_GRAPHICS_DIR } from "./feature-graphic.ts";
import {
  STORE_DEVICE_OUTPUTS,
  STORE_SCENES,
  STORE_SCREENSHOT_ORDER,
  type StoreLocale,
  type StoreScreenshotName,
} from "./store-design.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, "screenshots");
const PREVIEWS_DIR = path.resolve(ROOT_DIR, "previews");
const INTER_REGULAR_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Regular.ttf");
const INTER_BOLD_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Bold.ttf");

export const STORE_PREVIEW_SETS = [
  {
    device: "iphone-6.9",
    locale: "en",
    name: "app-store-iphone-6.9-en",
    platform: "App Store · iPhone 6.9″",
    slot: "1320×2868",
  },
  {
    device: "iphone-6.9",
    locale: "es",
    name: "app-store-iphone-6.9-es",
    platform: "App Store · iPhone 6.9″",
    slot: "1320×2868",
  },
  {
    device: "ipad-13",
    locale: "en",
    name: "app-store-ipad-13-en",
    platform: "App Store · iPad 13″",
    slot: "2064×2752",
  },
  {
    device: "ipad-13",
    locale: "es",
    name: "app-store-ipad-13-es",
    platform: "App Store · iPad 13″",
    slot: "2064×2752",
  },
  {
    device: "android",
    locale: "en",
    name: "google-play-phone-en",
    platform: "Google Play · Phone",
    slot: "1080×1920",
  },
  {
    device: "android",
    locale: "es",
    name: "google-play-phone-es",
    platform: "Google Play · Phone",
    slot: "1080×1920",
  },
  {
    device: "android-tablet",
    locale: "en",
    name: "google-play-tablet-en",
    platform: "Google Play · Tablet",
    slot: "2560×1600 · 7″ and 10″ slots",
  },
  {
    device: "android-tablet",
    locale: "es",
    name: "google-play-tablet-es",
    platform: "Google Play · Tablet",
    slot: "2560×1600 · 7″ and 10″ slots",
  },
] as const satisfies readonly {
  device: keyof typeof STORE_DEVICE_OUTPUTS;
  locale: StoreLocale;
  name: string;
  platform: string;
  slot: string;
}[];

export function getStorePreviewScreenshotFilename(
  device: keyof typeof STORE_DEVICE_OUTPUTS,
  name: StoreScreenshotName,
): string {
  return `${name}.${STORE_DEVICE_OUTPUTS[device].suffix}.png`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function main(): Promise<void> {
  await rm(PREVIEWS_DIR, { force: true, recursive: true });

  const [regularFont, boldFont] = await Promise.all([
    readFile(INTER_REGULAR_PATH),
    readFile(INTER_BOLD_PATH),
  ]);
  const browser = await chromium.launch({ headless: true });

  try {
    await mkdir(PREVIEWS_DIR, { recursive: true });

    for (const preview of STORE_PREVIEW_SETS) {
      const cards = await Promise.all(
        STORE_SCREENSHOT_ORDER.map(async (name) => {
          const screenshot = await readFile(
            path.resolve(
              SCREENSHOTS_DIR,
              preview.locale,
              preview.device,
              getStorePreviewScreenshotFilename(preview.device, name),
            ),
          );
          const scene = STORE_SCENES.find((candidate) => candidate.name === name);

          if (!scene) {
            throw new Error(`Missing scene for ${name}`);
          }

          return `<article><img alt="${escapeHtml(scene.copy[preview.locale].title.replaceAll("\n", " "))}" src="data:image/png;base64,${screenshot.toString("base64")}"></article>`;
        }),
      );
      const output = STORE_DEVICE_OUTPUTS[preview.device];
      const cardWidth = (2820 - 74 * 2 - 26 * 5) / 6;
      const viewportHeight = Math.max(
        760,
        Math.ceil(64 + 66 + 42 + cardWidth * (output.height / output.width) + 64),
      );
      const page = await browser.newPage({ viewport: { width: 2820, height: viewportHeight } });

      try {
        await page.setContent(`<!doctype html><html><head><style>
          @font-face { font-family: PreviewInter; font-weight: 400; src: url(data:font/ttf;base64,${regularFont.toString("base64")}); }
          @font-face { font-family: PreviewInter; font-weight: 700; src: url(data:font/ttf;base64,${boldFont.toString("base64")}); }
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; }
          body { padding: 64px 74px; color: #fafafa; font-family: PreviewInter, sans-serif; background: #09090b; }
          header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 42px; }
          h1 { margin: 0; font-size: 54px; letter-spacing: -.04em; }
          p { margin: 0 0 5px; color: #a1a1aa; font-size: 24px; }
          main { display: grid; grid-template-columns: repeat(6, 1fr); gap: 26px; }
          article { overflow: hidden; border: 1px solid #27272a; border-radius: 28px; background: #18181b; box-shadow: 0 20px 50px rgba(0,0,0,.35); }
          img { display: block; width: 100%; }
        </style></head><body>
          <header><h1>${preview.platform} · ${preview.locale === "en" ? "English" : "Español"}</h1><p>${preview.slot} · upload-ready store order</p></header>
          <main>${cards.join("")}</main>
        </body></html>`);
        await page.evaluate(async () => await document.fonts.ready);
        await page.screenshot({
          animations: "disabled",
          path: path.resolve(PREVIEWS_DIR, `${preview.name}.png`),
        });
      } finally {
        await page.close();
      }
    }

    const featureGraphics = await Promise.all(
      (["en", "es"] as const).map(async (locale) => ({
        image: await readFile(path.resolve(FEATURE_GRAPHICS_DIR, locale, "featureGraphic.png")),
        label: locale === "en" ? "English" : "Español",
      })),
    );
    const featureGraphicPage = await browser.newPage({ viewport: { width: 2280, height: 760 } });

    try {
      await featureGraphicPage.setContent(`<!doctype html><html><head><style>
        @font-face { font-family: PreviewInter; font-weight: 400; src: url(data:font/ttf;base64,${regularFont.toString("base64")}); }
        @font-face { font-family: PreviewInter; font-weight: 700; src: url(data:font/ttf;base64,${boldFont.toString("base64")}); }
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; }
        body { padding: 58px 74px; color: #fafafa; font-family: PreviewInter, sans-serif; background: #09090b; }
        header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 34px; }
        h1 { margin: 0; font-size: 52px; letter-spacing: -.04em; }
        header p { margin: 0 0 4px; color: #a1a1aa; font-size: 23px; }
        main { display: grid; grid-template-columns: repeat(2, 1fr); gap: 34px; }
        article { overflow: hidden; border: 1px solid #27272a; border-radius: 24px; background: #18181b; box-shadow: 0 18px 50px rgba(0,0,0,.34); }
        article img { display: block; width: 100%; }
        article p { margin: 0; padding: 14px 18px 16px; color: #d4d4d8; font-size: 20px; }
      </style></head><body>
        <header><h1>Google Play · Feature graphic</h1><p>1024 × 500 · localized</p></header>
        <main>${featureGraphics
          .map(
            ({ image, label }) =>
              `<article><img alt="" src="data:image/png;base64,${image.toString("base64")}"><p>${label}</p></article>`,
          )
          .join("")}</main>
      </body></html>`);
      await featureGraphicPage.evaluate(async () => await document.fonts.ready);
      await featureGraphicPage.screenshot({
        animations: "disabled",
        path: path.resolve(PREVIEWS_DIR, "google-play-feature-graphics.png"),
      });
    } finally {
      await featureGraphicPage.close();
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main();
}
