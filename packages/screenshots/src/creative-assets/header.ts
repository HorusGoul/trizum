import { HEADER_DURATION, palette, creativeCopy, type Locale } from "./data.ts";
import { move, out, mix } from "./motion.ts";
import { text, rect, brand } from "./svg.ts";
import { stack } from "./receipts.ts";
import { participant, transfer } from "./characters.ts";

export function renderHeaderScene(seconds: number, locale: Locale = "en", crop = false) {
  const raw = seconds % HEADER_DURATION;
  let t = raw;

  if (t >= 18) t = 0;

  const p = move((t - 9.4) / 1.2),
    c = creativeCopy[locale];

  const heading = t >= 15.08 ? c.done : t >= 10.6 ? c.settle : c.intro;

  let body = `${text(65, 64, heading, locale === "es" ? 58 : 62, palette.text, 800)}${brand(1595, 64, 0.6, palette.text, "end")}`;
  body += stack(t, locale, p);
  body += `<g opacity="${1 - out(p / 0.35)}">${[0, 1, 2].map((k) => rect(995, 160 + 150 * k, 600, 130, palette.surface, 27)).join("")}</g>`;

  for (let k = 0; k < 3; k++) body += participant(k, t, locale, p);
  body += transfer(t, 1, 11.3) + transfer(t, 2, 13.6);
  let ending = "";

  if (raw >= 17.3) {
    const entering = raw < 18,
      q = entering ? out((raw - 17.3) / 0.7) : raw < 19.2 ? 0 : out((raw - 19.2) / 0.8),
      xx = entering ? mix(3840, 0, q) : raw < 19.2 ? 0 : mix(0, -3840, q);

    ending = `<g transform="translate(${xx} 0)">${rect(0, 0, 3840, 1646, palette.bg, 0)}${brand(1920, 823, 3, "#ffffff")}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="1646" viewBox="${crop ? "1097 493 1646 661" : "0 0 3840 1646"}"><defs><clipPath id="safe"><rect width="1646" height="661"/></clipPath></defs><style>text{font-family:'Trizum Inter',sans-serif;letter-spacing:-.8px;font-variant-numeric:tabular-nums}</style><rect width="3840" height="1646" fill="${palette.bg}"/><path d="M0 380Q480 70 940 690T800 1646H0Z" fill="#0b2b46"/><path d="M3840 0H3200Q2810 520 3290 740T3840 1440Z" fill="#10314f"/><g transform="translate(1097 493)" clip-path="url(#safe)">${body}</g>${ending}</svg>`;
}
