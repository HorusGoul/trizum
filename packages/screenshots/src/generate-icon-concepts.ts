import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  ICON_CONCEPTS,
  ICON_CONCEPT_SIZE,
  renderIconConceptSvg,
  renderMonochromeMarkSvg,
} from "./icon-concepts.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIR = path.resolve(ROOT_DIR, "icon-concepts");
const PREVIEWS_DIR = path.resolve(ROOT_DIR, "previews");
const INTER_REGULAR_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Regular.ttf");
const INTER_BOLD_PATH = path.resolve(ROOT_DIR, "../pwa/api/assets/inter/Inter-Bold.ttf");

async function main(): Promise<void> {
  const [regularFont, boldFont] = await Promise.all([
    readFile(INTER_REGULAR_PATH),
    readFile(INTER_BOLD_PATH),
    mkdir(OUTPUT_DIR, { recursive: true }),
    mkdir(PREVIEWS_DIR, { recursive: true }),
  ]);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { height: ICON_CONCEPT_SIZE, width: ICON_CONCEPT_SIZE },
    });

    try {
      for (const concept of ICON_CONCEPTS) {
        await page.setContent(`<!doctype html><html><head><style>
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #020617; }
          svg { display: block; width: 100%; height: 100%; }
        </style></head><body>${renderIconConceptSvg(concept.id)}</body></html>`);
        await page.screenshot({
          animations: "disabled",
          path: path.resolve(OUTPUT_DIR, `${concept.id}.png`),
        });
      }
    } finally {
      await page.close();
    }

    const conceptImages = await Promise.all(
      ICON_CONCEPTS.map(async (concept) => ({
        ...concept,
        image: await readFile(path.resolve(OUTPUT_DIR, `${concept.id}.png`)),
      })),
    );
    const previewPage = await browser.newPage({ viewport: { height: 1520, width: 2700 } });

    try {
      await previewPage.setContent(`<!doctype html><html><head><style>
        @font-face { font-family: IconInter; font-weight: 400; src: url(data:font/ttf;base64,${regularFont.toString("base64")}); }
        @font-face { font-family: IconInter; font-weight: 700 900; src: url(data:font/ttf;base64,${boldFont.toString("base64")}); }
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; }
        body { padding: 66px 72px; color: #fafafa; font-family: IconInter, sans-serif; background: #09090b; }
        header { display: flex; align-items: end; justify-content: space-between; margin-bottom: 42px; }
        h1 { margin: 0; font-size: 58px; letter-spacing: -.045em; }
        header p { margin: 0 0 7px; color: #a1a1aa; font-size: 23px; }
        main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
        article { min-width: 0; height: 1260px; padding: 34px; border: 1px solid #27272a; border-radius: 34px; background: #111113; box-shadow: 0 24px 70px rgba(0,0,0,.36); }
        .concept-heading { display: flex; align-items: start; justify-content: space-between; min-height: 104px; }
        .number { color: #38bdf8; font-size: 18px; font-weight: 700; letter-spacing: .12em; }
        h2 { margin: 7px 0 0; font-size: 34px; letter-spacing: -.035em; }
        .recommended { padding: 9px 13px; border-radius: 999px; color: #bae6fd; font-size: 15px; font-weight: 700; background: #075985; }
        .hero { display: grid; grid-template-columns: 1fr 184px; align-items: center; gap: 25px; min-height: 440px; }
        .icon { display: block; width: 100%; box-shadow: 0 24px 54px rgba(0,0,0,.42); }
        .squircle { border-radius: 23%; }
        .circle { border-radius: 50%; }
        .round-square { border-radius: 31%; }
        .side-masks { display: grid; gap: 26px; }
        .side-masks figure { margin: 0; }
        .side-masks figcaption { margin-top: 9px; color: #71717a; font-size: 14px; text-align: center; }
        .section-label { margin: 12px 0 18px; color: #71717a; font-size: 15px; font-weight: 700; letter-spacing: .12em; }
        .sizes { display: flex; min-height: 156px; align-items: end; justify-content: space-around; gap: 20px; padding: 25px 20px 20px; border: 1px solid #27272a; border-radius: 24px; background: #09090b; }
        .size { display: grid; justify-items: center; gap: 12px; color: #71717a; font-size: 14px; }
        .size img { border-radius: 23%; box-shadow: 0 8px 20px rgba(0,0,0,.45); }
        .themed { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; padding: 22px; border: 1px solid #27272a; border-radius: 24px; background: #09090b; }
        .theme { display: grid; aspect-ratio: 1; place-items: center; border-radius: 28%; }
        .theme svg { width: 76%; height: 76%; }
        .theme-blue { color: #1e3a8a; background: #dbeafe; }
        .theme-green { color: #064e3b; background: #d1fae5; }
        .theme-slate { color: #e2e8f0; background: #1e293b; }
        .description { margin: 25px 2px 0; color: #a1a1aa; font-size: 20px; line-height: 1.45; }
      </style></head><body>
        <header><h1>trizum · icon concepts</h1><p>Store, launcher masks, small sizes, and monochrome themes</p></header>
        <main>${conceptImages
          .map(
            (concept, index) => `<article>
              <div class="concept-heading">
                <div><div class="number">0${index + 1}</div><h2>${concept.label}</h2></div>
                ${index === 0 ? '<span class="recommended">RECOMMENDED</span>' : ""}
              </div>
              <div class="hero">
                <img class="icon squircle" alt="" src="data:image/png;base64,${concept.image.toString("base64")}">
                <div class="side-masks">
                  <figure><img class="icon circle" alt="" src="data:image/png;base64,${concept.image.toString("base64")}"><figcaption>circle</figcaption></figure>
                  <figure><img class="icon round-square" alt="" src="data:image/png;base64,${concept.image.toString("base64")}"><figcaption>squircle</figcaption></figure>
                </div>
              </div>
              <div class="section-label">LAUNCHER SIZES</div>
              <div class="sizes">
                ${[112, 80, 56, 40]
                  .map(
                    (size) =>
                      `<div class="size"><img alt="" width="${size}" height="${size}" src="data:image/png;base64,${concept.image.toString("base64")}"><span>${size}px</span></div>`,
                  )
                  .join("")}
              </div>
              <div class="section-label">THEMED / MONOCHROME</div>
              <div class="themed">
                ${["theme-blue", "theme-green", "theme-slate"]
                  .map((theme) => `<div class="theme ${theme}">${renderMonochromeMarkSvg()}</div>`)
                  .join("")}
              </div>
              <p class="description">${concept.description}</p>
            </article>`,
          )
          .join("")}</main>
      </body></html>`);
      await previewPage.evaluate(async () => await document.fonts.ready);
      await previewPage.screenshot({
        animations: "disabled",
        path: path.resolve(PREVIEWS_DIR, "icon-concepts.png"),
      });
    } finally {
      await previewPage.close();
    }
  } finally {
    await browser.close();
  }
}

void main();
