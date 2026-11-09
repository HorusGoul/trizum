import { renderBrandMark } from "../store-design.ts";
import type { Locale } from "./data.ts";

export type SearchConcept = "a" | "b" | "c";

export const SEARCH_CONCEPT_NAMES = {
  a: "Shared adventures",
  b: "Clear balances",
  c: "Together offline",
};

const copy = {
  en: {
    a: "Split trip<br>expenses",
    b: "See who<br>owes what",
    c: "Split expenses<br>Even offline",
  },
  es: {
    a: "Divide los gastos<br>del viaje",
    b: "Mira quién<br>debe qué",
    c: "Divide gastos<br>Incluso sin conexión",
  },
};

const themes = {
  a: ["#38bdf8", "#07152c", "#082f49"],
  b: ["#38bdf8", "#07152c", "#082f49"],
  c: ["#7dd3fc", "#09142c", "#172554"],
};

// These are the original search proposals, kept as drafts until one is selected.
export function renderSearchConcept(
  variant: SearchConcept,
  locale: Locale,
  images: Record<string, string>,
  fonts: string,
): string {
  const [accent, bg, glow] = themes[variant];
  const screen = variant === "b" ? images.balances : images.expenses;
  const screen2 = variant === "b" ? images.expenses : images.balances;
  const title = copy[locale][variant];

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
  ${fonts}
  *{box-sizing:border-box}html,body{margin:0;width:1920px;height:1280px;overflow:hidden}
  body{position:relative;background:${bg};color:#f1f7ff;font-family:"Store Inter",sans-serif}
  .ambient{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,${glow} 0,transparent 58%),radial-gradient(ellipse at 10% 10%,${accent}1a 0,transparent 45%)}
  .ring{position:absolute;left:50%;top:50%;width:1060px;height:1060px;transform:translate(-50%,-50%);border:2px solid ${accent}20;border-radius:50%;box-shadow:0 0 0 120px ${accent}06,0 0 0 240px ${accent}04}
  .content{position:absolute;z-index:4;${variant === "c" ? "top:390px;left:420px;width:1080px;text-align:center" : "top:400px;left:430px;width:650px"}}
  .brand{display:flex;justify-content:${variant === "c" ? "center" : "flex-start"};align-items:center;gap:15px;font-size:43px;font-weight:700;letter-spacing:-.025em;color:${accent};margin-bottom:32px}
  .brand svg{width:64px;height:64px}
  h1{margin:0;font-size:${variant === "c" && locale === "es" ? 88 : locale === "es" ? 98 : 110}px;line-height:1.02;font-weight:800;letter-spacing:-.065em}
  h1 span{color:${accent}}
  .surface{position:absolute;overflow:hidden;border:3px solid #ffffff24;border-radius:54px;background:#061c2e;box-shadow:0 60px 140px #0009;padding:12px}
  .surface img{display:block;width:100%;border-radius:40px}
  .one{width:590px;height:1010px;left:1110px;top:245px;transform:rotate(6deg)}
  .two{width:530px;left:-230px;top:680px;transform:rotate(-12deg);opacity:.42}
  .vignette{position:absolute;inset:0;background:linear-gradient(0deg,${bg},transparent 32%);z-index:3;pointer-events:none}
  .route{position:absolute;inset:0;width:100%;height:100%;color:${accent}}
  .token{position:absolute;display:grid;place-items:center;width:170px;height:170px;border-radius:32%;background:linear-gradient(140deg,${accent}33,${accent}09);border:2px solid ${accent}55;box-shadow:0 32px 70px #0005;color:${accent}}
  .token svg{width:70%;height:70%}.t1{left:140px;top:190px;transform:rotate(-14deg)}.t2{right:160px;top:930px;transform:rotate(14deg)}.t3{right:155px;top:170px;transform:rotate(10deg)}.t4{left:155px;bottom:150px;transform:rotate(-8deg)}
  </style></head><body><div class="ambient"></div><div class="ring"></div>
  ${
    variant === "c"
      ? `<svg class="route" viewBox="0 0 1920 1280" fill="none"><path d="M ${1920 * 0.14} ${1280 * 0.3} C ${1920 * 0.25} ${1280 * 0.1},${1920 * 0.3} ${1280 * 0.8},${1920 * 0.5} ${1280 * 0.77} S ${1920 * 0.77} ${1280 * 0.96},${1920 * 0.86} ${1280 * 0.35}" stroke="currentColor" stroke-opacity=".27" stroke-width="4" /></svg>
  <div class="token t1">${renderBrandMark()}</div><div class="token t3"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><rect x="23" y="16" width="54" height="68" rx="9"/><path d="M36 35h28M36 50h28M36 65h17"/></svg></div>
  <div class="token t2">${renderBrandMark()}</div><div class="token t4"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M20 45h60M50 24v53M25 47l-12 22h24L25 47ZM75 47 63 69h24L75 47ZM34 80h32"/></svg></div>`
      : `<div class="surface one"><img alt="${variant === "b" ? "Real trizum balances screen" : "Real trizum expenses screen"}" src="${screen}"></div><div class="surface two"><img alt="Real trizum screen" src="${screen2}"></div>`
  }
  <div class="vignette"></div><main class="content"><div class="brand">${renderBrandMark()}<span>trizum</span></div><h1>${title.replace("<br>", "<br><span>")}</span></h1></main></body></html>`;
}
