import { palette, peopleColors } from "./data.ts";

export function text(
  x: number,
  y: number,
  s: string,
  size = 40,
  color = palette.text,
  weight = 700,
  anchor = "start",
) {
  return `<text x="${x}" y="${y}" data-center-y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${s}</text>`;
}

export function normalizeArtwork(root: Element) {
  for (const n of root.querySelectorAll<SVGTextElement>("text[data-center-y]")) {
    const b = n.getBBox();
    n.setAttribute("dy", String(Number(n.dataset.centerY) - b.y - b.height / 2));
  }

  const context = document.createElement("canvas").getContext("2d")!;

  for (const group of root.querySelectorAll<SVGGElement>("[data-balance-center-y]")) {
    let top = Infinity,
      bottom = -Infinity;

    for (const n of group.querySelectorAll<SVGTextElement>("text")) {
      context.font = `${n.getAttribute("font-weight")} ${n.getAttribute("font-size")}px 'Trizum Inter'`;

      const metrics = context.measureText(n.textContent || ""),
        baseline = Number(n.getAttribute("y")) + Number(n.getAttribute("dy") || 0);

      top = Math.min(top, baseline - metrics.actualBoundingBoxAscent);
      bottom = Math.max(bottom, baseline + metrics.actualBoundingBoxDescent);
    }

    group.setAttribute(
      "transform",
      `translate(0 ${Number(group.dataset.balanceCenterY) - (top + bottom) / 2})`,
    );
  }

  for (const n of root.querySelectorAll<SVGGElement>("[data-brand-align]")) {
    const b = n.getBBox();
    n.setAttribute(
      "transform",
      `translate(${-b.x - b.width * (n.dataset.brandAlign === "end" ? 1 : 0.5)} ${-b.y - b.height / 2})`,
    );
  }
}

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  r = 24,
  stroke = "",
) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="2"` : ""}/>`;
}

export function logo(x: number, y: number, size: number, color = palette.bright) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 512 512"><path d="M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835M273.945 323.23H356.862" fill="none" stroke="${color}" stroke-width="27" stroke-linecap="round"/></svg>`;
}

export function brand(
  x: number,
  y: number,
  scale: number,
  color = palette.text,
  anchor = "middle",
) {
  return `<g data-brand-position="${x},${y}" transform="translate(${x} ${y}) scale(${scale})"><g data-brand-align="${anchor}">${logo(0, 0, 120, color)}${text(118, 60, "trizum", 72, color, 600)}</g></g>`;
}

export function blob(i: number, x: number, y: number, size: number, reaction = 0, reach = 0) {
  const silhouettes = [
    "M49 6C77 0 96 23 94 51C101 78 78 96 49 94C21 101 3 80 7 54C0 26 19 2 49 6Z",
    "M24 12C43 3 79 2 89 24C105 44 98 80 81 91C56 104 16 95 8 76C-2 54 1 25 24 12Z",
    "M52 3C71 3 80 17 83 35C101 47 101 72 86 87C69 104 34 100 17 86C-1 73 3 45 15 32C23 11 34 0 52 3Z",
  ];

  const scale = 1 + 0.07 * reaction,
    sy = 1 - 0.045 * reaction;

  const smile =
    i === 1 ? "M33 64Q48 80 67 62" : i === 2 ? "M32 64Q49 78 66 63" : "M34 64Q50 77 67 62";

  const eyes =
    i === 2
      ? '<path d="M30 46q6-7 12 0M59 46q6-7 12 0" fill="none" stroke-width="4.5"/>'
      : '<ellipse cx="36" cy="46" rx="4" ry="5"/><ellipse cx="64" cy="46" rx="4" ry="5"/>';

  return `<g transform="translate(${x} ${y}) scale(${(size / 100) * scale} ${(size / 100) * sy}) rotate(${reach * (i === 2 ? 7 : -7)}) translate(-50 -50)"><g stroke="${peopleColors[i]}" stroke-width="7" fill="none" stroke-linecap="round"><path d="M13 67Q${-5 - 14 * reach} ${66 - 7 * reach} ${-8 - 23 * reach} ${60 - 22 * reach}"/></g><path d="${silhouettes[i]}" fill="${peopleColors[i]}"/><g fill="${palette.ink}" stroke="${palette.ink}" stroke-linecap="round">${eyes}<path d="${smile}" fill="none" stroke-width="4.5"/>${i === 0 ? '<path d="M33 19q15-18 25-4q4 7-4 9" fill="none" stroke-width="4"/>' : i === 1 ? '<path d="M26 22l10-12 6 11" fill="none" stroke-width="4"/>' : ""}</g></g>`;
}
