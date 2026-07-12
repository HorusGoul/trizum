import type { Page } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const STORE_SCREENSHOT_ORDER = [
  "expense-log",
  "balances",
  "expense-editor",
  "expense-details",
  "stats",
  "group-members",
] as const;

export type StoreScreenshotName = (typeof STORE_SCREENSHOT_ORDER)[number];
export type StoreLocale = "en" | "es";
export type StorePlatform = "app-store" | "google-play" | "marketing";

export const STORE_DEVICE_OUTPUTS = {
  android: { width: 1080, height: 1920, platform: "google-play", suffix: "portrait" },
  "android-tablet": {
    width: 2560,
    height: 1600,
    platform: "google-play",
    suffix: "landscape",
  },
  "iphone-6.9": { width: 1320, height: 2868, platform: "app-store", suffix: "portrait" },
  "ipad-13": { width: 2064, height: 2752, platform: "app-store", suffix: "portrait" },
} as const satisfies Record<
  string,
  { height: number; platform: StorePlatform; suffix: string; width: number }
>;

interface StoreCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
}

interface StoreScene {
  accent: string;
  accentSoft: string;
  copy: Record<StoreLocale, StoreCopy>;
  name: StoreScreenshotName;
  tilt: number;
}

export const STORE_SCENES: readonly StoreScene[] = [
  {
    name: "expense-log",
    accent: "#f97316",
    accentSoft: "#fb923c",
    tilt: -1.5,
    copy: {
      en: {
        eyebrow: "SHARED EXPENSES",
        title: "Keep trip expenses\ntogether.",
        subtitle: "Everyone can add costs and see the same totals.",
      },
      es: {
        eyebrow: "GASTOS COMPARTIDOS",
        title: "Todos los gastos\ndel viaje, juntos.",
        subtitle: "Cualquiera puede añadir gastos y ver los mismos totales.",
      },
    },
  },
  {
    name: "balances",
    accent: "#22c55e",
    accentSoft: "#4ade80",
    tilt: 1.25,
    copy: {
      en: {
        eyebrow: "BALANCES",
        title: "See who owes what.",
        subtitle: "Balances update as expenses are added.",
      },
      es: {
        eyebrow: "SALDOS",
        title: "Mira quién debe qué.",
        subtitle: "Los saldos se actualizan con cada gasto.",
      },
    },
  },
  {
    name: "expense-editor",
    accent: "#38bdf8",
    accentSoft: "#7dd3fc",
    tilt: -1,
    copy: {
      en: {
        eyebrow: "EDIT EXPENSES",
        title: "Fix a split\nin seconds.",
        subtitle: "Change the payer, amount, date, or shares.",
      },
      es: {
        eyebrow: "EDITAR GASTOS",
        title: "Corrige un reparto\nen segundos.",
        subtitle: "Cambia quién pagó, el importe, la fecha o el reparto.",
      },
    },
  },
  {
    name: "expense-details",
    accent: "#a78bfa",
    accentSoft: "#c4b5fd",
    tilt: 1.4,
    copy: {
      en: {
        eyebrow: "EXPENSE DETAILS",
        title: "See exactly how\nit was split.",
        subtitle: "Payer, date, amount, and each person’s share.",
      },
      es: {
        eyebrow: "DETALLES DEL GASTO",
        title: "Mira exactamente\ncómo se repartió.",
        subtitle: "Pagador, fecha, importe y parte de cada persona.",
      },
    },
  },
  {
    name: "stats",
    accent: "#facc15",
    accentSoft: "#fde047",
    tilt: -1.2,
    copy: {
      en: {
        eyebrow: "STATS",
        title: "See what the\ngroup spent.",
        subtitle: "Compare totals and spending by person.",
      },
      es: {
        eyebrow: "ESTADÍSTICAS",
        title: "Mira cuánto gastó\nel grupo.",
        subtitle: "Compara el total y el gasto de cada persona.",
      },
    },
  },
  {
    name: "group-members",
    accent: "#fb7185",
    accentSoft: "#fda4af",
    tilt: 1,
    copy: {
      en: {
        eyebrow: "GROUPS",
        title: "Choose who\nyou are.",
        subtitle: "Each member sees the expenses and balances that matter to them.",
      },
      es: {
        eyebrow: "GRUPOS",
        title: "Elige quién eres.",
        subtitle: "Cada persona ve los gastos y saldos que le corresponden.",
      },
    },
  },
];

interface ComposeStoreScreenshotOptions {
  height: number;
  locale: StoreLocale;
  outputPath: string;
  page: Page;
  platform: StorePlatform;
  rawScreenshotPath: string;
  scene: StoreScene;
  width: number;
}

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const INTER_REGULAR_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Regular.ttf");
const INTER_BOLD_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Bold.ttf");

let fontFacesPromise: Promise<string> | undefined;

async function getFontFaces(): Promise<string> {
  fontFacesPromise ??= Promise.all([readFile(INTER_REGULAR_PATH), readFile(INTER_BOLD_PATH)]).then(
    ([regular, bold]) => `
      @font-face {
        font-family: "Store Inter";
        font-style: normal;
        font-weight: 400;
        src: url(data:font/ttf;base64,${regular.toString("base64")}) format("truetype");
      }
      @font-face {
        font-family: "Store Inter";
        font-style: normal;
        font-weight: 700 900;
        src: url(data:font/ttf;base64,${bold.toString("base64")}) format("truetype");
      }
    `,
  );

  return fontFacesPromise;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function brandMark(): string {
  return `<svg aria-hidden="true" viewBox="0 0 512 512">
    <path d="M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835M273.945 323.23H356.862" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="17.928" />
  </svg>`;
}

export async function composeStoreScreenshot({
  height,
  locale,
  outputPath,
  page,
  platform,
  rawScreenshotPath,
  scene,
  width,
}: ComposeStoreScreenshotOptions): Promise<void> {
  const [fontFaces, screenshot] = await Promise.all([getFontFaces(), readFile(rawScreenshotPath)]);
  const copy = scene.copy[locale];
  const isTablet = width / height > 0.6;
  const isGooglePlay = platform === "google-play";
  const headlineSize = isTablet ? 104 : isGooglePlay ? 76 : 112;
  const sidePadding = isTablet ? 150 : isGooglePlay ? 72 : 96;
  const deviceWidth = isTablet ? Math.round(width * 0.72) : Math.round(width * 0.76);
  const deviceTop = isTablet ? 650 : isGooglePlay ? 500 : 690;
  const frameRadius = isTablet ? 68 : isGooglePlay ? 58 : 74;
  const framePadding = isTablet ? 22 : 18;
  const texture = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity=".22"/></svg>`,
  );

  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html>
    <html lang="${locale}">
      <head><meta charset="utf-8"><style>
        ${fontFaces}
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        body {
          color: #fff;
          font-family: "Store Inter", sans-serif;
          background:
            radial-gradient(circle at 12% 8%, ${scene.accent}66 0, transparent 34%),
            radial-gradient(circle at 92% 45%, ${scene.accentSoft}33 0, transparent 38%),
            linear-gradient(150deg, #18181b 0%, #09090b 58%, #030303 100%);
        }
        body::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,${texture}");
          mix-blend-mode: soft-light;
          opacity: .12;
          pointer-events: none;
        }
        .orb {
          position: absolute;
          width: ${Math.round(width * 0.7)}px;
          height: ${Math.round(width * 0.7)}px;
          right: ${Math.round(width * -0.22)}px;
          top: ${Math.round(height * 0.19)}px;
          border: 2px solid ${scene.accent}55;
          border-radius: 50%;
          box-shadow: 0 0 0 ${Math.round(width * 0.09)}px ${scene.accent}12, 0 0 0 ${Math.round(width * 0.2)}px ${scene.accent}08;
        }
        .header { position: absolute; z-index: 2; top: ${isGooglePlay ? 58 : 78}px; left: ${sidePadding}px; right: ${sidePadding}px; }
        .brand { display: flex; align-items: center; gap: 16px; margin-bottom: ${isGooglePlay ? 30 : 42}px; color: ${scene.accentSoft}; font-size: ${isGooglePlay ? 23 : 30}px; font-weight: 700; letter-spacing: .13em; }
        .brand svg { width: ${isGooglePlay ? 38 : 48}px; height: ${isGooglePlay ? 38 : 48}px; }
        .eyebrow { margin-bottom: ${isGooglePlay ? 15 : 20}px; color: ${scene.accentSoft}; font-size: ${isGooglePlay ? 21 : 28}px; font-weight: 700; letter-spacing: .1em; }
        h1 { max-width: ${isTablet ? 1500 : 1080}px; margin: 0; font-size: ${headlineSize}px; font-weight: 800; letter-spacing: -.055em; line-height: .94; white-space: pre-line; }
        p { max-width: ${isTablet ? 1250 : 980}px; margin: ${isGooglePlay ? 22 : 30}px 0 0; color: #d4d4d8; font-size: ${isTablet ? 36 : isGooglePlay ? 26 : 34}px; line-height: 1.28; }
        .device {
          position: absolute;
          z-index: 1;
          top: ${deviceTop}px;
          left: 50%;
          width: ${deviceWidth}px;
          padding: ${framePadding}px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: ${frameRadius}px;
          background: #050505;
          box-shadow: 0 60px 130px rgba(0,0,0,.56), 0 0 0 1px rgba(255,255,255,.06), 0 0 90px ${scene.accent}2f;
          transform: translateX(-50%) rotate(${scene.tilt}deg);
          transform-origin: 50% 15%;
        }
        .device img { display: block; width: 100%; border-radius: ${frameRadius - framePadding}px; }
      </style></head>
      <body>
        <div class="orb"></div>
        <header class="header">
          ${scene.name === "expense-log" ? `<div class="brand">${brandMark()}<span>TRIZUM</span></div>` : ""}
          <div class="eyebrow">${escapeHtml(copy.eyebrow)}</div>
          <h1>${escapeHtml(copy.title)}</h1>
          <p>${escapeHtml(copy.subtitle)}</p>
        </header>
        <div class="device"><img alt="" src="data:image/png;base64,${screenshot.toString("base64")}"></div>
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
