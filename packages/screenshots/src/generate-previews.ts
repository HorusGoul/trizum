import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { FEATURE_GRAPHICS_DIR } from "./feature-graphic.ts";
import { STORE_SCENES, STORE_SCREENSHOT_ORDER, type StoreLocale } from "./store-design.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SCREENSHOTS_DIR = path.resolve(ROOT_DIR, "screenshots");
const PREVIEWS_DIR = path.resolve(ROOT_DIR, "previews");
const INTER_REGULAR_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Regular.ttf");
const INTER_BOLD_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Bold.ttf");

const previewSets = [
  { device: "iphone-6.9", locale: "en", name: "app-store-en", platform: "App Store" },
  { device: "iphone-6.9", locale: "es", name: "app-store-es", platform: "App Store" },
  { device: "android", locale: "en", name: "google-play-en", platform: "Google Play" },
  { device: "android", locale: "es", name: "google-play-es", platform: "Google Play" },
] as const satisfies readonly {
  device: string;
  locale: StoreLocale;
  name: string;
  platform: string;
}[];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function main(): Promise<void> {
  const [regularFont, boldFont] = await Promise.all([
    readFile(INTER_REGULAR_PATH),
    readFile(INTER_BOLD_PATH),
  ]);
  const browser = await chromium.launch({ headless: true });

  try {
    await mkdir(PREVIEWS_DIR, { recursive: true });

    for (const preview of previewSets) {
      const cards = await Promise.all(
        STORE_SCREENSHOT_ORDER.map(async (name) => {
          const screenshot = await readFile(
            path.resolve(SCREENSHOTS_DIR, preview.locale, preview.device, `${name}.portrait.png`),
          );
          const scene = STORE_SCENES.find((candidate) => candidate.name === name);

          if (!scene) {
            throw new Error(`Missing scene for ${name}`);
          }

          return `<article><img alt="${escapeHtml(scene.copy[preview.locale].title.replaceAll("\n", " "))}" src="data:image/png;base64,${screenshot.toString("base64")}"></article>`;
        }),
      );
      const page = await browser.newPage({ viewport: { width: 2820, height: 1120 } });

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
          <header><h1>${preview.platform} · ${preview.locale === "en" ? "English" : "Español"}</h1><p>Upload-ready assets in store order</p></header>
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

void main();
