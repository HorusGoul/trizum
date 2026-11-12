import {
  palette,
  peopleNames,
  expenseStarts,
  creativeCopy,
  peopleColors,
  type Locale,
} from "./data.ts";
import { mix, clamp, spring, out, move, balancesAt } from "./motion.ts";
import { blob, text, rect } from "./svg.ts";
import { formatDemoMoney } from "./money.ts";

export function oldPosition(i: number) {
  return { x: 1068, y: 210 + 150 * i };
}

function newPosition(i: number) {
  return [
    { x: 1270, y: 180 },
    { x: 1010, y: 450 },
    { x: 1510, y: 450 },
  ][i];
}

export function participant(i: number, t: number, locale: Locale, p: number) {
  const c = creativeCopy[locale],
    old = oldPosition(i),
    next = newPosition(i),
    x = mix(old.x, next.x, p),
    y = mix(old.y, next.y, p),
    v = balancesAt(t)[i];

  const adding =
    t >= expenseStarts[i] && t < expenseStarts[i] + 0.9
      ? Math.sin(clamp((t - expenseStarts[i]) / 0.9) * Math.PI)
      : 0;

  const giving =
    i === 1 && t >= 11.3 && t < 12.3
      ? Math.sin((t - 11.3) * Math.PI)
      : i === 2 && t >= 13.6 && t < 14.6
        ? Math.sin((t - 13.6) * Math.PI)
        : 0;

  const received =
    i === 0
      ? Math.max(t >= 12.3 ? 1 - spring(t - 12.3) : 0, t >= 14.6 ? 1 - spring(t - 14.6) : 0)
      : 0;

  const react = adding * 0.8 + giving * 0.5 + received;

  const nx = x,
    ny = y + mix(60, 85, p),
    mx = p < 0.5 ? 1563 : x,
    my = p < 0.5 ? old.y - 12 : y + 142,
    sx = mx,
    sy = p < 0.5 ? old.y + 32 : y + 182,
    anchor = p < 0.5 ? "end" : "middle";

  const readable = Math.min(1, 1 - out((p - 0.05) / 0.22) + out((p - 0.86) / 0.14));
  const status = t >= 15.08 ? c.settled : v > 0 ? c.back : v < 0 ? c.owes : c.even;

  return `<g>${blob(i, x, y, mix(94, 116, p), react, adding + giving)}${text(nx, ny, peopleNames[i], mix(32, 39, p), palette.text, 800, "middle")}<g ${p < 0.5 ? `data-balance-center-y="${225 + 150 * i}"` : ""} opacity="${readable}">${text(mx, my, formatDemoMoney(v, true), mix(45, 50, p), v < 0 ? palette.coral : v > 0 ? palette.bright : palette.muted, 800, anchor)}${text(sx, sy, status, mix(27, 26, p), palette.muted, 500, anchor)}</g></g>`;
}

export function transfer(t: number, from: number, start: number) {
  if (t < start || t > start + 1.15) return "";

  const p = move((t - start) / 1),
    a = newPosition(from),
    b = newPosition(0),
    cx = from === 1 ? 1020 : 1545,
    cy = 190;

  const x = (1 - p) ** 2 * a.x + 2 * (1 - p) * p * cx + p * p * b.x,
    y = (1 - p) ** 2 * a.y + 2 * (1 - p) * p * cy + p * p * b.y;

  const opacity = out((t - start) / 0.12) * (1 - out((t - start - 1) / 0.15));

  return `<g fill="none" stroke="${peopleColors[from]}" stroke-width="4" stroke-linecap="round" opacity="${0.28 * opacity}"><path d="M${a.x} ${a.y}Q${cx} ${cy} ${b.x} ${b.y}"/></g><g opacity="${opacity}" transform="translate(${x} ${y}) scale(${0.86 + 0.14 * spring(t - start)})">${rect(-75, -33, 150, 66, peopleColors[from], 28)}${text(0, 0, formatDemoMoney(1000), 29, palette.ink, 800, "middle")}</g>`;
}
