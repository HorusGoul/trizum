import type { Browser, Page } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  getStoreFontFaces,
  renderBrandMark,
  STORE_COLOR_SYSTEM,
  type StoreLocale,
} from "./store-design.ts";

export const PLAY_FEATURE_GRAPHIC = { height: 500, width: 1024 } as const;

export const FEATURE_GRAPHIC_COPY = {
  en: {
    eyebrow: "SHARED EXPENSES",
    title: "Split expenses.\nSee who owes what.",
  },
  es: {
    eyebrow: "GASTOS COMPARTIDOS",
    title: "Divide gastos.\nMira quién debe qué.",
  },
} as const satisfies Record<StoreLocale, { eyebrow: string; title: string }>;

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const RAW_SCREENSHOTS_DIR = path.resolve(ROOT_DIR, ".captures");
export const FEATURE_GRAPHICS_DIR = path.resolve(ROOT_DIR, "feature-graphics");

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function composeFeatureGraphic(
  page: Page,
  locale: StoreLocale,
  outputPath: string,
): Promise<void> {
  const copy = FEATURE_GRAPHIC_COPY[locale];
  const [fontFaces, expenseLog, balances] = await Promise.all([
    getStoreFontFaces(),
    readFile(path.resolve(RAW_SCREENSHOTS_DIR, locale, "android", "expense-log.portrait.png")),
    readFile(path.resolve(RAW_SCREENSHOTS_DIR, locale, "android", "balances.portrait.png")),
  ]);
  const texture = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".18"/></svg>`,
  );

  await page.setViewportSize(PLAY_FEATURE_GRAPHIC);
  await page.setContent(`<!doctype html>
    <html lang="${locale}">
      <head><meta charset="utf-8"><style>
        ${fontFaces}
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        body {
          color: #fafafa;
          font-family: "Store Inter", sans-serif;
          background:
            radial-gradient(circle at 18% -18%, ${STORE_COLOR_SYSTEM.sky}80 0, transparent 42%),
            radial-gradient(circle at 88% 112%, ${STORE_COLOR_SYSTEM.emerald}4d 0, transparent 42%),
            linear-gradient(145deg, ${STORE_COLOR_SYSTEM.backgroundHighlight} 0%, ${STORE_COLOR_SYSTEM.backgroundRaised} 54%, ${STORE_COLOR_SYSTEM.background} 100%);
        }
        body::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,${texture}");
          mix-blend-mode: soft-light;
          opacity: .11;
          pointer-events: none;
        }
        .copy {
          position: absolute;
          z-index: 4;
          top: 72px;
          left: 72px;
          width: 490px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 54px;
          font-size: 27px;
          font-weight: 700;
          letter-spacing: .035em;
        }
        .brand svg { width: 48px; height: 48px; color: ${STORE_COLOR_SYSTEM.skyBright}; }
        .eyebrow {
          margin-bottom: 13px;
          color: ${STORE_COLOR_SYSTEM.skySoft};
          font-size: 15px;
          font-weight: 700;
          letter-spacing: .13em;
        }
        h1 {
          margin: 0;
          font-size: 55px;
          font-weight: 800;
          letter-spacing: -.055em;
          line-height: .97;
          white-space: pre-line;
        }
        .halo {
          position: absolute;
          z-index: 1;
          top: 39px;
          left: 559px;
          width: 390px;
          height: 390px;
          border: 1px solid ${STORE_COLOR_SYSTEM.skyBright}3d;
          border-radius: 50%;
          box-shadow: 0 0 0 62px ${STORE_COLOR_SYSTEM.sky}0e, 0 0 0 126px ${STORE_COLOR_SYSTEM.emerald}06;
        }
        .surface {
          position: absolute;
          z-index: 3;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 27px;
          background: ${STORE_COLOR_SYSTEM.background};
          box-shadow: 0 28px 70px rgba(0,0,0,.52), 0 0 55px ${STORE_COLOR_SYSTEM.sky}1c;
        }
        .surface img { display: block; width: 100%; }
        .expense-log {
          top: 50px;
          left: 600px;
          width: 310px;
          transform: rotate(-3deg);
        }
        .balances {
          z-index: 2;
          top: 118px;
          left: 826px;
          width: 274px;
          border-color: ${STORE_COLOR_SYSTEM.emeraldBright}40;
          box-shadow: 0 26px 68px rgba(0,0,0,.5), 0 0 55px ${STORE_COLOR_SYSTEM.emerald}1a;
          transform: rotate(4deg);
        }
      </style></head>
      <body>
        <div class="halo"></div>
        <section class="copy">
          <div class="brand">${renderBrandMark()}<span>trizum</span></div>
          <div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>
          <h1>${escapeHtml(copy.title)}</h1>
        </section>
        <div class="surface balances"><img alt="" src="data:image/png;base64,${balances.toString("base64")}"></div>
        <div class="surface expense-log"><img alt="" src="data:image/png;base64,${expenseLog.toString("base64")}"></div>
      </body>
    </html>`);

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => reject(new Error("Image failed to load")), {
                once: true,
              });
            }),
      ),
    );
  });
  await page.screenshot({ animations: "disabled", path: outputPath, scale: "css" });
}

export async function generateFeatureGraphics(
  browser: Browser,
  locales: readonly StoreLocale[],
): Promise<void> {
  const page = await browser.newPage({ viewport: PLAY_FEATURE_GRAPHIC });

  try {
    for (const locale of locales) {
      const outputDirectory = path.resolve(FEATURE_GRAPHICS_DIR, locale);
      await mkdir(outputDirectory, { recursive: true });
      await composeFeatureGraphic(
        page,
        locale,
        path.resolve(outputDirectory, "featureGraphic.png"),
      );
    }
  } finally {
    await page.close();
  }
}
