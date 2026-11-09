import {
  palette,
  expenseAmounts,
  expenseStarts,
  creativeCopy,
  peopleNames,
  peopleColors,
  type Locale,
} from "./data.ts";
import { mix, spring, out } from "./motion.ts";
import { blob, text, logo } from "./svg.ts";
import { oldPosition } from "./characters.ts";
import { formatDemoMoney } from "./money.ts";

function receiptPath(w: number, h: number) {
  let s = `M22 0H${w - 22}Q${w} 0 ${w} 22V${h - 10}`;

  for (let x = w; x > 0; x -= 50)
    s += `L${Math.max(0, x - 25)} ${h}L${Math.max(0, x - 50)} ${h - 10}`;

  return s + "V22Q0 0 22 0Z";
}

function receipt(i: number, locale: Locale, h = 300, contentOpacity = 1) {
  const c = creativeCopy[locale];

  return `<path d="${receiptPath(650, h)}" fill="${palette.card}" stroke="${peopleColors[i]}" stroke-width="2"/><g opacity="${contentOpacity}">${blob(i, 48, 37, 51)}${text(99, 29, c.labels[i], 35, palette.text, 800)}${text(99, 62, peopleNames[i], 23, peopleColors[i], 500)}${text(618, 44, formatDemoMoney(expenseAmounts[i]), 40, peopleColors[i], 800, "end")}<path d="M32 87h586" stroke="${palette.line}" stroke-width="2"/>${text(32, 163, formatDemoMoney(expenseAmounts[i] / 3), 76, palette.bright, 800)}${text(32, 225, c.each, 30, palette.muted, 500)}${[0, 1, 2].map((k) => blob(k, 465 + k * 65, 229, 42)).join("")}</g>`;
}

export function stack(t: number, locale: Locale, p: number) {
  let s = "";

  for (let i = 0; i < 3; i++) {
    if (t < expenseStarts[i]) continue;

    const dt = t - expenseStarts[i],
      arrival = out(dt / 0.95),
      sp = spring(dt),
      from = oldPosition(i);

    const targetY = 140 + 90 * i;
    const baseScale = 0.12 + 0.88 * sp;

    const cx = mix(865, 390, arrival),
      cy = Math.max(
        mix(from.y, targetY + 150, arrival) - 70 * Math.sin(arrival * Math.PI),
        125 + baseScale * 165,
      );

    const x = mix(cx, 390, p),
      y = mix(cy, 375.5, p),
      h = mix(300, 422, p);

    const rotation = ((1 - arrival) * (i === 1 ? 7 : -7) + [-1.4, 0.8, -1][i] * arrival) * (1 - p);
    const fade = out(dt / 0.12) * (1 - out((p - 0.74) / 0.2));
    s += `<g transform="translate(${x} ${y}) scale(${mix(baseScale, 1, p)}) rotate(${rotation}) translate(-325 ${-h / 2})" opacity="${fade}">${receipt(i, locale, h)}</g>`;
  }

  if (p > 0.72) {
    const opacity = out((p - 0.72) / 0.28),
      c = creativeCopy[locale];

    s += `<g opacity="${opacity}" transform="translate(65 164.5)"><path d="${receiptPath(650, 422)}" fill="${palette.card}" stroke="${palette.bright}" stroke-width="2"/>${logo(32, 28, 74)}${text(128, 49, c.total, 46, palette.text, 800)}${text(128, 95, c.expenses, 28, palette.muted, 500)}${text(32, 213, formatDemoMoney(12000), 102, palette.bright, 900)}<path d="M32 292h586" stroke="${palette.line}" stroke-width="2"/>${text(32, 350, locale === "es" ? "40,00 € por persona" : "40,00 € each", 34, palette.text, 700)}</g>`;
  }

  return s;
}
