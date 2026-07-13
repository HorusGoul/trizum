export const ICON_CONCEPT_SIZE = 1024;

export const ICON_CONCEPTS = [
  {
    background: "#0369a1",
    description: "The primary store and launcher appearance.",
    foreground: "#f8fafc",
    id: "refined-default",
    label: "Default",
  },
  {
    background: "#020617",
    description: "A restrained dark appearance with a cooler mark.",
    foreground: "#7dd3fc",
    id: "refined-dark",
    label: "Dark",
  },
  {
    background: "#e0f2fe",
    description: "A light appearance that keeps the same silhouette.",
    foreground: "#0c4a6e",
    id: "refined-light",
    label: "Light",
  },
] as const;

export type IconConceptId = (typeof ICON_CONCEPTS)[number]["id"];

const MARK_PATH =
  "M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835M273.945 323.23H356.862";
const MARK_TRANSFORM = "translate(256 256) scale(1.06) translate(-256 -256)";

function mark(stroke: string, strokeWidth = 21): string {
  return `<path d="${MARK_PATH}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" />`;
}

export function renderIconConceptSvg(id: IconConceptId): string {
  const concept = ICON_CONCEPTS.find((candidate) => candidate.id === id);

  if (!concept) {
    throw new Error(`Unknown icon concept: ${id}`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${concept.background}" />
    <g transform="${MARK_TRANSFORM}">${mark(concept.foreground)}</g>
  </svg>`;
}

export function renderMonochromeMarkSvg(): string {
  return `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="${MARK_TRANSFORM}">${mark("currentColor", 22)}</g>
  </svg>`;
}
