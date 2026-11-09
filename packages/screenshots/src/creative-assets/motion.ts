import { balanceStates, expenseStarts } from "./data.ts";

export function clamp(x: number) {
  return Math.max(0, Math.min(1, x));
}

function curve(x: number, a: number, b: number, c: number, d: number) {
  const n = clamp(x);

  let lo = 0,
    hi = 1;

  for (let i = 0; i < 18; i++) {
    const t = (lo + hi) / 2,
      v = 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * c + t ** 3;

    if (v < n) lo = t;
    else hi = t;
  }

  const t = (lo + hi) / 2;

  return 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * d + t ** 3;
}

export function out(x: number) {
  return curve(x, 0.23, 1, 0.32, 1);
}

export function move(x: number) {
  return curve(x, 0.77, 0, 0.175, 1);
}

export function mix(a: number, b: number, p: number) {
  return a + (b - a) * p;
}

export function spring(t: number) {
  if (t <= 0) return 0;
  const w = Math.sqrt(75);

  return 1 - Math.exp(-5 * t) * (Math.cos(w * t) + (5 / w) * Math.sin(w * t));
}

export function balancesAt(t: number) {
  let v = [0, 0, 0];
  const events = [...expenseStarts.map((s) => s + 0.95), 12.3, 14.6];
  events.forEach((s, i) => {
    if (t >= s) {
      const p = out((t - s) / 0.48);
      v = balanceStates[i].map((n, k) => Math.round(mix(n, balanceStates[i + 1][k], p)) || 0);
      v[2] = -v[0] - v[1] || 0;
    }
  });

  return v;
}
