export const ICON_CONCEPT_SIZE = 1024;

export const ICON_CONCEPTS = [
  {
    description: "The clearest evolution of the current mark.",
    id: "midnight-flat",
    label: "Midnight flat",
  },
  {
    description: "A layered version designed for more depth on iOS.",
    id: "midnight-layered",
    label: "Midnight layered",
  },
  {
    description: "Blue expenses meet emerald balances.",
    id: "balanced-split",
    label: "Balanced split",
  },
] as const;

export type IconConceptId = (typeof ICON_CONCEPTS)[number]["id"];

const TOP_PATH =
  "M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878";
const CURVE_PATH =
  "M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835";
const DASH_PATH = "M273.945 323.23H356.862";
const FULL_PATH = `${TOP_PATH} ${CURVE_PATH} ${DASH_PATH}`;
const MARK_TRANSFORM = "translate(256 256) scale(1.16) translate(-256 -256)";

function sharedDefinitions(): string {
  return `<defs>
    <linearGradient id="midnight" x1="60" y1="32" x2="470" y2="492" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0f172a" />
      <stop offset=".55" stop-color="#075985" />
      <stop offset="1" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="deep-midnight" x1="40" y1="24" x2="480" y2="500" gradientUnits="userSpaceOnUse">
      <stop stop-color="#020617" />
      <stop offset=".56" stop-color="#0f172a" />
      <stop offset="1" stop-color="#0c4a6e" />
    </linearGradient>
    <radialGradient id="sky-glow" cx="0" cy="0" r="1" gradientTransform="translate(128 98) rotate(42) scale(430)">
      <stop stop-color="#38bdf8" stop-opacity=".42" />
      <stop offset="1" stop-color="#38bdf8" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="emerald-glow" cx="0" cy="0" r="1" gradientTransform="translate(445 438) rotate(-135) scale(330)">
      <stop stop-color="#10b981" stop-opacity=".32" />
      <stop offset="1" stop-color="#10b981" stop-opacity="0" />
    </radialGradient>
  </defs>`;
}

function fullMark(stroke: string, strokeWidth = 28, extra = ""): string {
  return `<path d="${FULL_PATH}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke" ${extra} />`;
}

export function renderIconConceptSvg(id: IconConceptId): string {
  let artwork: string;

  if (id === "midnight-flat") {
    artwork = `
      <rect width="512" height="512" fill="url(#midnight)" />
      <rect width="512" height="512" fill="url(#sky-glow)" />
      <g transform="${MARK_TRANSFORM}">${fullMark("#f0f9ff")}</g>`;
  } else if (id === "midnight-layered") {
    artwork = `
      <rect width="512" height="512" fill="url(#deep-midnight)" />
      <rect x="91" y="91" width="330" height="330" rx="112" fill="#0ea5e9" fill-opacity=".13" transform="rotate(-7 256 256)" />
      <circle cx="256" cy="256" r="170" fill="none" stroke="#38bdf8" stroke-opacity=".16" stroke-width="2" />
      <g transform="${MARK_TRANSFORM}">
        ${fullMark("#0369a1", 48, 'opacity=".48" transform="translate(0 8)"')}
        ${fullMark("#f0f9ff", 27)}
      </g>`;
  } else {
    artwork = `
      <rect width="512" height="512" fill="url(#deep-midnight)" />
      <rect width="512" height="512" fill="url(#sky-glow)" />
      <rect width="512" height="512" fill="url(#emerald-glow)" />
      <g transform="${MARK_TRANSFORM}" fill="none" stroke-linecap="round" stroke-width="28" vector-effect="non-scaling-stroke">
        <path d="${TOP_PATH}" stroke="#38bdf8" />
        <path d="${CURVE_PATH}" stroke="#f0f9ff" />
        <path d="${DASH_PATH}" stroke="#34d399" />
      </g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    ${sharedDefinitions()}
    ${artwork}
  </svg>`;
}

export function renderMonochromeMarkSvg(): string {
  return `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <g transform="${MARK_TRANSFORM}">
      ${fullMark("currentColor", 30)}
    </g>
  </svg>`;
}
