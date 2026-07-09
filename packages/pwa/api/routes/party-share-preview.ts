import { isValidDocumentId, Repo, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { Hono } from "hono";
import type { ApiEnv, ApiHonoEnv } from "../env";
import {
  DEFAULT_LOCALE,
  normalizeSupportedLocale,
  type SupportedLocale,
} from "../../src/lib/locales.js";
import { getLogger } from "../../src/lib/log.js";
import { DEFAULT_PARTY_SYMBOL, type Party } from "../../src/models/party.js";

const logger = getLogger("api", "partySharePreview");

const DEFAULT_AUTOMERGE_WSS_URL = "wss://server.trizum.app/sync";
const DEFAULT_PREVIEW_TIMEOUT_MS = 10_000;
const PREVIEW_CACHE_SUCCESS_TTL_MS = 60_000;
const PREVIEW_CACHE_FALLBACK_TTL_MS = 5_000;
const MAX_DESCRIPTION_LENGTH = 180;
const MAX_IMAGE_DESCRIPTION_LENGTH = 210;
const PARTY_SHARE_IMAGE_WIDTH = 1200;
const PARTY_SHARE_IMAGE_HEIGHT = 630;
const PARTY_SHARE_IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const PARTY_SHARE_LEGACY_LOCALE_PARAM = "locale";
const PARTY_SHARE_IMAGE_TITLE_MAX_WIDTH = 780;
const PARTY_SHARE_IMAGE_TITLE_MAX_FONT_SIZE = 78;
const PARTY_SHARE_IMAGE_TITLE_MIN_FONT_SIZE = 48;
const PARTY_SHARE_IMAGE_DESCRIPTION_MAX_WIDTH = 780;
const PARTY_SHARE_IMAGE_DESCRIPTION_FONT_SIZE = 34;
const PARTY_SHARE_IMAGE_DESCRIPTION_MAX_LINES = 2;
const PARTY_SHARE_IMAGE_BRAND_MARK_SIZE = 72;
const TITLE_TAG_PATTERN = /<title\b[^>]*>[\s\S]*?<\/title>/i;
const PARTY_SHARE_LOCALE_PARAM = "lang";
const INTER_FONT_FACES = [
  { path: "/assets/inter/Inter-Regular.ttf", weight: 400 },
  { path: "/assets/inter/Inter-Bold.ttf", weight: 700 },
  { path: "/assets/inter/Inter-ExtraBold.ttf", weight: 800 },
] as const;
const TRIZUM_MARK_PATH = "/maskable.svg";
const PARTY_SHARE_IMAGE_STYLES = {
  canvas:
    "display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 0 88px; font-family: Inter, sans-serif; color: #FFFFFF; background: linear-gradient(180deg, #050505 0%, #000000 100%);",
  content: "display: flex; flex-direction: column; width: 100%; height: 100%;",
  ctaButton:
    "display: flex; align-items: center; justify-content: center; width: 300px; height: 78px; padding: 0 36px; border: 3px solid #FFFFFF; border-radius: 39px; background: rgba(0,0,0,0.18);",
  ctaText: "display: flex; font-size: 34px; font-weight: 800; color: #FFFFFF; line-height: 1;",
  description:
    "display: flex; flex-direction: column; width: 780px; height: 82px; margin-top: 26px; font-size: 34px; line-height: 1.18; color: #B7B7B7; overflow: hidden;",
  descriptionLine: "display: flex; width: 780px; overflow: hidden; white-space: nowrap;",
  footer: "display: flex; align-items: center; margin-top: 40px;",
  footerBrand: "display: flex; align-items: center; margin-left: 42px;",
  footerBrandMark: `display: flex; width: ${PARTY_SHARE_IMAGE_BRAND_MARK_SIZE}px; height: ${PARTY_SHARE_IMAGE_BRAND_MARK_SIZE}px; margin-left: 22px; overflow: hidden; background: #000000;`,
  footerBrandName:
    "display: flex; margin-left: 10px; font-size: 34px; font-weight: 400; color: #FFFFFF;",
  hero: "display: flex; align-items: center; margin-top: 182px;",
  partyCopy: "display: flex; flex-direction: column; margin-left: 48px;",
  partyIcon:
    "display: flex; align-items: center; justify-content: center; width: 124px; height: 124px; color: #FFFFFF; font-size: 108px; line-height: 1; filter: grayscale(1) brightness(2.35) contrast(1.8);",
  partyIconTile:
    "display: flex; align-items: center; justify-content: center; width: 196px; height: 196px; border-radius: 40px; background: linear-gradient(180deg, #171717 0%, #050505 100%); box-shadow: 0 0 0 1px rgba(255,255,255,0.03);",
  title: "display: flex; max-width: 780px; font-weight: 800; line-height: 0.98; letter-spacing: 0;",
  viaText: "display: flex; font-size: 34px; color: #9A9A9A;",
} as const;

const PARTY_SHARE_COPY = {
  en: {
    fallbackDescription: "Split bills with friends, family, and roommates.",
    fallbackName: "Shared expenses",
    imageFallbackDescription: "Split expenses and settle up together on trizum.",
    joinParty: "Join party",
    metadataPurpose: "Open this party to split expenses and settle up together on trizum.",
    previewAlt: (title: string) => `${title} preview`,
    title: (partyName: string) => `Join ${partyName} on trizum`,
    via: "via",
  },
  es: {
    fallbackDescription: "Divide gastos con amigos, familiares y compañeros de piso.",
    fallbackName: "Gastos compartidos",
    imageFallbackDescription: "Divide gastos y salda cuentas juntos en trizum.",
    joinParty: "Unirse",
    metadataPurpose: "Abre este grupo para dividir gastos y saldar cuentas juntos en trizum.",
    previewAlt: (title: string) => `Vista previa de ${title}`,
    title: (partyName: string) => `Únete a ${partyName} en trizum`,
    via: "vía",
  },
} satisfies Record<
  SupportedLocale,
  {
    fallbackDescription: string;
    fallbackName: string;
    imageFallbackDescription: string;
    joinParty: string;
    metadataPurpose: string;
    previewAlt: (title: string) => string;
    title: (partyName: string) => string;
    via: string;
  }
>;

type PartyShareCopy = (typeof PARTY_SHARE_COPY)[SupportedLocale];

const CRAWLER_USER_AGENT_PATTERNS = [
  /applebot/i,
  /baiduspider/i,
  /bitlybot/i,
  /discordbot/i,
  /embedly/i,
  /facebookexternalhit/i,
  /facebot/i,
  /googlebot/i,
  /linkedinbot/i,
  /mastodon/i,
  /meta-externalagent/i,
  /pinterest/i,
  /quora link preview/i,
  /redditbot/i,
  /skypeuripreview/i,
  /slackbot/i,
  /telegrambot/i,
  /twitterbot/i,
  /vkshare/i,
  /whatsapp/i,
  /yahoo/i,
];

interface CachedPartySharePreview {
  expiresAt: number;
  preview: PartySharePreview;
}

export interface PartySharePreview {
  description: string;
  isFallback: boolean;
  name: string;
  symbol: string;
  version: string;
}

interface PartySharePreviewRouteOptions {
  createImageResponse?: (
    html: string,
    context: PartyShareImageResponseContext,
  ) => Promise<Response> | Response;
  loadPreview?: (partyId: string, env: ApiEnv, request: Request) => Promise<PartySharePreview>;
}

interface PartyShareImageResponseContext {
  env: ApiEnv;
  request: Request;
}

type PartyPreviewDocument = Pick<Party, "description" | "name" | "symbol" | "type">;

interface SocialMetaTag {
  attribute: "name" | "property";
  content: string;
  value: string;
}

interface InterFontData {
  data: ArrayBuffer;
  weight: (typeof INTER_FONT_FACES)[number]["weight"];
}

let interFontData: Promise<InterFontData[]> | undefined;
let trizumMarkDataUrl: Promise<string> | undefined;
const previewCache = new Map<string, CachedPartySharePreview>();

export const partySharePreviewRoute = createPartySharePreviewRoute();

export function createPartySharePreviewRoute(options: PartySharePreviewRouteOptions = {}) {
  const route = new Hono<ApiHonoEnv>();
  const loadPreview = options.loadPreview ?? getPartySharePreview;
  const createImageResponse = options.createImageResponse ?? createWorkersOgImageResponse;

  route.get("/party/:partyId", async (c) => {
    const request = c.req.raw;

    if (!isPartyPreviewRequest(request)) {
      return c.env.ASSETS.fetch(request);
    }

    const partyId = c.req.param("partyId");
    const assetResponse = await c.env.ASSETS.fetch(request);
    const html = await assetResponse.text();
    const locale = resolvePartyShareLocale(request);
    const preview = await loadPreview(partyId, c.env, request);
    const headTags = renderPartyShareHeadTags({
      locale,
      partyId,
      preview,
      requestUrl: new URL(request.url),
    });

    return new Response(injectPartyShareHeadTags(html, headTags), {
      headers: withVaryHeader(
        withHeader(assetResponse.headers, "Content-Type", "text/html; charset=utf-8"),
        "Accept-Language",
      ),
      status: assetResponse.status,
      statusText: assetResponse.statusText,
    });
  });

  route.get("/api/og/party/:partyId", async (c) => {
    const partyId = c.req.param("partyId");
    const locale = resolvePartyShareLocale(c.req.raw);
    const preview = await loadPreview(partyId, c.env, c.req.raw);
    const trizumMarkUrl = await loadTrizumMarkDataUrl(c.env, c.req.raw).catch((error) => {
      logger.warning("Could not load trizum mark for party share preview: {errorMessage}", {
        error: getErrorDetails(error),
        errorMessage: getErrorMessage(error),
      });

      return getPublicAssetUrl(c.req.raw, TRIZUM_MARK_PATH);
    });
    const html = renderPartyShareImageHtml(preview, {
      locale,
      trizumMarkUrl,
    });

    return await createImageResponse(html, {
      env: c.env,
      request: c.req.raw,
    });
  });

  route.all("/party/*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return route;
}

async function createWorkersOgImageResponse(
  html: string,
  { env, request }: PartyShareImageResponseContext,
) {
  const { ImageResponse } = await import("workers-og");
  const interFonts = await loadInterFontData(env, request);

  return new ImageResponse(html, {
    emoji: "twemoji",
    format: "png",
    fonts: interFonts.map(({ data, weight }) => ({
      data,
      name: "Inter",
      style: "normal" as const,
      weight,
    })),
    height: PARTY_SHARE_IMAGE_HEIGHT,
    headers: {
      "Cache-Control": PARTY_SHARE_IMAGE_CACHE_CONTROL,
      Vary: "Accept-Language",
    },
    width: PARTY_SHARE_IMAGE_WIDTH,
  });
}

async function loadInterFontData(env: ApiEnv, request: Request) {
  interFontData ??= fetchInterFontData(env, request);

  return interFontData.catch((error) => {
    interFontData = undefined;
    throw error;
  });
}

async function fetchInterFontData(env: ApiEnv, request: Request) {
  return await Promise.all(
    INTER_FONT_FACES.map(async ({ path, weight }) => {
      const fontUrl = new URL(path, request.url);
      const response = await env.ASSETS.fetch(new Request(fontUrl));

      if (!response.ok) {
        throw new Error(`Could not load Inter font asset ${path}: ${response.status}`);
      }

      return {
        data: await response.arrayBuffer(),
        weight,
      };
    }),
  );
}

async function loadTrizumMarkDataUrl(env: ApiEnv, request: Request) {
  trizumMarkDataUrl ??= fetchTrizumMarkDataUrl(env, request);

  return trizumMarkDataUrl.catch((error) => {
    trizumMarkDataUrl = undefined;
    throw error;
  });
}

async function fetchTrizumMarkDataUrl(env: ApiEnv, request: Request) {
  const markUrl = new URL(TRIZUM_MARK_PATH, request.url);
  const response = await env.ASSETS.fetch(new Request(markUrl));

  if (!response.ok) {
    throw new Error(`Could not load trizum mark asset: ${response.status}`);
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`;
}

export function isPartyPreviewRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const previewOverride = requestUrl.searchParams.get("preview");

  if (previewOverride === "1" || previewOverride === "true") {
    return true;
  }

  if (previewOverride === "0" || previewOverride === "false") {
    return false;
  }

  if (request.method !== "GET") {
    return false;
  }

  const accept = request.headers.get("Accept") ?? "";

  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
    return false;
  }

  const userAgent = request.headers.get("User-Agent") ?? "";

  return CRAWLER_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function resolvePartyShareLocale(request: Request) {
  const requestUrl = new URL(request.url);

  return (
    resolveLocaleSearchParam(requestUrl.searchParams) ??
    resolveAcceptLanguageLocale(request.headers.get("Accept-Language")) ??
    DEFAULT_LOCALE
  );
}

function resolveLocaleSearchParam(searchParams: URLSearchParams) {
  return (
    normalizeSupportedLocale(searchParams.get(PARTY_SHARE_LOCALE_PARAM)) ??
    normalizeSupportedLocale(searchParams.get(PARTY_SHARE_LEGACY_LOCALE_PARAM))
  );
}

function resolveAcceptLanguageLocale(value: string | null) {
  if (!value) {
    return null;
  }

  const languageRanges = value
    .split(",")
    .map((range, index) => {
      const [languageTag, ...parameters] = range.trim().split(";");

      return {
        index,
        languageTag: languageTag?.trim(),
        quality: getAcceptLanguageQuality(parameters),
      };
    })
    .filter((range) => range.languageTag && range.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  for (const range of languageRanges) {
    const locale = normalizeSupportedLocale(range.languageTag);

    if (locale) {
      return locale;
    }
  }

  return null;
}

function getAcceptLanguageQuality(parameters: string[]) {
  const qualityParameter = parameters.find((parameter) =>
    parameter.trim().toLowerCase().startsWith("q="),
  );

  if (!qualityParameter) {
    return 1;
  }

  const quality = Number.parseFloat(qualityParameter.trim().slice(2));

  if (!Number.isFinite(quality)) {
    return 0;
  }

  return Math.min(1, Math.max(0, quality));
}

export function injectPartyShareHeadTags(html: string, headTags: string) {
  const htmlWithoutDefaultTitle = html.replace(TITLE_TAG_PATTERN, "");

  if (htmlWithoutDefaultTitle.includes("</head>")) {
    return htmlWithoutDefaultTitle.replace("</head>", `${headTags}\n  </head>`);
  }

  return `${headTags}\n${htmlWithoutDefaultTitle}`;
}

export function renderPartyShareHeadTags({
  locale = DEFAULT_LOCALE,
  partyId,
  preview,
  requestUrl,
}: {
  locale?: SupportedLocale;
  partyId: string;
  preview: PartySharePreview;
  requestUrl: URL;
}) {
  const copy = getPartyShareCopy(locale);
  const pageUrl = new URL(`/party/${encodeURIComponent(partyId)}`, requestUrl.origin);
  const imageUrl = new URL(`/api/og/party/${encodeURIComponent(partyId)}`, requestUrl.origin);

  pageUrl.searchParams.set(PARTY_SHARE_LOCALE_PARAM, locale);
  imageUrl.searchParams.set("v", preview.version);
  imageUrl.searchParams.set(PARTY_SHARE_LOCALE_PARAM, locale);

  const title = getPartyShareTitle(preview, copy);
  const description = getPartyShareDescription(preview, copy);

  return [
    `<title>${escapeHtmlText(title)}</title>`,
    renderSocialMetaTag(nameMeta("description", description)),
    renderSocialMetaTag(propertyMeta("og:type", "website")),
    renderSocialMetaTag(propertyMeta("og:site_name", "trizum")),
    renderSocialMetaTag(propertyMeta("og:title", title)),
    renderSocialMetaTag(propertyMeta("og:description", description)),
    renderSocialMetaTag(propertyMeta("og:url", pageUrl.toString())),
    renderSocialMetaTag(propertyMeta("og:image", imageUrl.toString())),
    renderSocialMetaTag(propertyMeta("og:image:width", String(PARTY_SHARE_IMAGE_WIDTH))),
    renderSocialMetaTag(propertyMeta("og:image:height", String(PARTY_SHARE_IMAGE_HEIGHT))),
    renderSocialMetaTag(propertyMeta("og:image:alt", copy.previewAlt(title))),
    renderSocialMetaTag(nameMeta("twitter:card", "summary_large_image")),
    renderSocialMetaTag(nameMeta("twitter:title", title)),
    renderSocialMetaTag(nameMeta("twitter:description", description)),
    renderSocialMetaTag(nameMeta("twitter:image", imageUrl.toString())),
  ].join("\n    ");
}

export function renderPartyShareImageHtml(
  preview: PartySharePreview,
  options: { locale?: SupportedLocale; trizumMarkUrl?: string } = {},
) {
  const copy = getPartyShareCopy(options.locale ?? DEFAULT_LOCALE);
  const trizumMarkUrl = options.trizumMarkUrl ?? TRIZUM_MARK_PATH;
  const title = formatImageTitle(preview.name, copy);
  const descriptionLines = wrapTextForLines(
    preview.description || copy.imageFallbackDescription,
    PARTY_SHARE_IMAGE_DESCRIPTION_MAX_WIDTH,
    PARTY_SHARE_IMAGE_DESCRIPTION_FONT_SIZE,
    PARTY_SHARE_IMAGE_DESCRIPTION_MAX_LINES,
    {
      maxLength: MAX_IMAGE_DESCRIPTION_LENGTH,
    },
  );

  return `
    <div style="${PARTY_SHARE_IMAGE_STYLES.canvas}">
      <div style="${PARTY_SHARE_IMAGE_STYLES.content}">
        <div style="${PARTY_SHARE_IMAGE_STYLES.hero}">
          <div style="${PARTY_SHARE_IMAGE_STYLES.partyIconTile}">
            <div style="${PARTY_SHARE_IMAGE_STYLES.partyIcon}">${escapeHtmlText(preview.symbol)}</div>
          </div>

          <div style="${PARTY_SHARE_IMAGE_STYLES.partyCopy}">
            <div style="${imageTitleStyle(title.fontSize)}">${escapeHtmlText(title.text)}</div>
            <div style="${PARTY_SHARE_IMAGE_STYLES.description}">${renderDescriptionLines(descriptionLines)}</div>
          </div>
        </div>

        <div style="${PARTY_SHARE_IMAGE_STYLES.footer}">
          ${renderJoinPartyButton(copy)}
          ${renderFooterBrand(trizumMarkUrl, copy)}
        </div>
      </div>
    </div>
  `;
}

export function createPartySharePreviewFromParty(
  party: PartyPreviewDocument,
  locale: SupportedLocale = DEFAULT_LOCALE,
): PartySharePreview {
  const copy = getPartyShareCopy(locale);
  const name = sanitizePlainText(party.name, 72) || copy.fallbackName;
  const description = sanitizePlainText(party.description, MAX_DESCRIPTION_LENGTH);
  const symbol = sanitizePlainText(party.symbol, 8) || DEFAULT_PARTY_SYMBOL;

  return {
    description,
    isFallback: false,
    name,
    symbol,
    version: createPreviewVersion({ description, name, symbol }),
  };
}

export function createFallbackPartySharePreview(
  locale: SupportedLocale = DEFAULT_LOCALE,
): PartySharePreview {
  const copy = getPartyShareCopy(locale);
  const preview = {
    description: copy.fallbackDescription,
    isFallback: true,
    name: copy.fallbackName,
    symbol: DEFAULT_PARTY_SYMBOL,
  };

  return {
    ...preview,
    version: createPreviewVersion(preview),
  };
}

async function getPartySharePreview(partyId: string, env: ApiEnv, request: Request) {
  const locale = resolvePartyShareLocale(request);
  const cacheKey = `${getAutomergeWssUrl(env, request)}:${partyId}:${locale}`;
  const cachedPreview = previewCache.get(cacheKey);

  if (cachedPreview && cachedPreview.expiresAt > Date.now()) {
    return cachedPreview.preview;
  }

  const preview = await loadPartySharePreviewFromAutomerge(partyId, env, request, locale).catch(
    (error) => {
      logger.warning("Could not load party share preview: {errorMessage}", {
        error: getErrorDetails(error),
        errorMessage: getErrorMessage(error),
      });
      return createFallbackPartySharePreview(locale);
    },
  );
  const ttl = preview.isFallback ? PREVIEW_CACHE_FALLBACK_TTL_MS : PREVIEW_CACHE_SUCCESS_TTL_MS;

  previewCache.set(cacheKey, {
    expiresAt: Date.now() + ttl,
    preview,
  });

  return preview;
}

async function loadPartySharePreviewFromAutomerge(
  partyId: string,
  env: ApiEnv,
  request: Request,
  locale: SupportedLocale,
) {
  if (!isValidDocumentId(partyId)) {
    return createFallbackPartySharePreview(locale);
  }

  const documentId = partyId as DocumentId;
  const timeoutMs = getPreviewTimeoutMs(env);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  let repo: Repo | undefined;

  try {
    repo = new Repo({
      isEphemeral: true,
      network: [new BrowserWebSocketClientAdapter(getAutomergeWssUrl(env, request))],
      peerId: `party-share-preview:${crypto.randomUUID()}` as PeerId,
      shareConfig: {
        access: (_peerId, nextDocumentId) => Promise.resolve(nextDocumentId === documentId),
        announce: (_peerId, nextDocumentId) => Promise.resolve(nextDocumentId === documentId),
      },
    });

    const handle = await repo.find<PartyPreviewDocument>(documentId, {
      allowableStates: ["ready"],
      signal: abortController.signal,
    });
    const party = handle.doc();

    if (!party || party.type !== "party") {
      return createFallbackPartySharePreview(locale);
    }

    return createPartySharePreviewFromParty(party, locale);
  } finally {
    clearTimeout(timeoutId);
    await repo?.shutdown().catch((error) => {
      logger.warning("Could not shut down party share preview repo: {errorMessage}", {
        error: getErrorDetails(error),
        errorMessage: getErrorMessage(error),
      });
    });
  }
}

function getAutomergeWssUrl(env: ApiEnv, request: Request) {
  const configuredUrl = env.AUTOMERGE_WSS_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return "wss://dev-sync.trizum.app";
  }

  return DEFAULT_AUTOMERGE_WSS_URL;
}

function getPreviewTimeoutMs(env: ApiEnv) {
  const value = env.PARTY_SHARE_PREVIEW_TIMEOUT_MS;
  const parsedValue = value ? Number.parseInt(value, 10) : NaN;

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return DEFAULT_PREVIEW_TIMEOUT_MS;
}

function getPublicAssetUrl(request: Request, path: string) {
  return new URL(path, request.url).toString();
}

function getPartyShareCopy(locale: SupportedLocale) {
  return PARTY_SHARE_COPY[locale];
}

function getPartyShareTitle(preview: PartySharePreview, copy: PartyShareCopy) {
  return copy.title(preview.name);
}

function getPartyShareDescription(preview: PartySharePreview, copy: PartyShareCopy) {
  return limitText(
    preview.description ? `${preview.description} ${copy.metadataPurpose}` : copy.metadataPurpose,
    240,
  );
}

function propertyMeta(property: string, content: string): SocialMetaTag {
  return { attribute: "property", content, value: property };
}

function nameMeta(name: string, content: string): SocialMetaTag {
  return { attribute: "name", content, value: name };
}

function renderSocialMetaTag(tag: SocialMetaTag) {
  return `<meta ${tag.attribute}="${escapeHtmlAttribute(tag.value)}" content="${escapeHtmlAttribute(tag.content)}" />`;
}

function imageTitleStyle(fontSize: number) {
  return `${PARTY_SHARE_IMAGE_STYLES.title} font-size: ${fontSize}px; white-space: nowrap;`;
}

function renderDescriptionLines(lines: string[]) {
  return lines
    .map(
      (line) =>
        `<div style="${PARTY_SHARE_IMAGE_STYLES.descriptionLine}">${escapeHtmlText(line)}</div>`,
    )
    .join("");
}

function formatImageTitle(value: string, copy: PartyShareCopy) {
  const text = normalizePreviewText(value) || copy.fallbackName;
  const fontSize = getFittingFontSize(
    text,
    PARTY_SHARE_IMAGE_TITLE_MAX_WIDTH,
    PARTY_SHARE_IMAGE_TITLE_MAX_FONT_SIZE,
    PARTY_SHARE_IMAGE_TITLE_MIN_FONT_SIZE,
  );

  return {
    fontSize,
    text: truncateTextForWidth(text, PARTY_SHARE_IMAGE_TITLE_MAX_WIDTH, fontSize),
  };
}

function getFittingFontSize(
  value: string,
  maxWidth: number,
  maxFontSize: number,
  minFontSize: number,
) {
  const units = getVisualTextUnits(value);

  if (units === 0) {
    return maxFontSize;
  }

  return Math.max(minFontSize, Math.min(maxFontSize, Math.floor(maxWidth / units)));
}

function truncateTextForWidth(
  value: string,
  maxWidth: number,
  fontSize: number,
  options: { maxLength?: number } = {},
) {
  const text = limitText(
    normalizePreviewText(value),
    options.maxLength ?? Number.POSITIVE_INFINITY,
  );

  return truncateTextForUnits(text, maxWidth / fontSize);
}

function wrapTextForLines(
  value: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  options: { maxLength?: number } = {},
) {
  const text = limitText(
    normalizePreviewText(value),
    options.maxLength ?? Number.POSITIVE_INFINITY,
  );
  const maxUnitsPerLine = maxWidth / fontSize;
  const lines: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0 && lines.length < maxLines) {
    remainingText = remainingText.trimStart();

    if (getVisualTextUnits(remainingText) <= maxUnitsPerLine) {
      lines.push(remainingText);
      break;
    }

    if (lines.length === maxLines - 1) {
      lines.push(truncateTextForUnits(remainingText, maxUnitsPerLine));
      break;
    }

    const line = getWrappedLine(remainingText, maxUnitsPerLine);
    lines.push(line);
    remainingText = remainingText.slice(line.length);
  }

  return lines.length > 0 ? lines : [""];
}

function getWrappedLine(value: string, maxUnits: number) {
  const textThatFits = takeTextForUnits(value, maxUnits);
  const lastSpaceIndex = textThatFits.lastIndexOf(" ");

  if (lastSpaceIndex > 0) {
    return textThatFits.slice(0, lastSpaceIndex);
  }

  return textThatFits;
}

function truncateTextForUnits(value: string, maxUnits: number) {
  if (getVisualTextUnits(value) <= maxUnits) {
    return value;
  }

  const ellipsis = "...";
  const ellipsisUnits = getVisualTextUnits(ellipsis);
  const targetUnits = Math.max(0, maxUnits - ellipsisUnits);

  return `${takeTextForUnits(value, targetUnits).trimEnd()}${ellipsis}`;
}

function takeTextForUnits(value: string, maxUnits: number) {
  let nextUnits = 0;
  let nextText = "";

  for (const character of value) {
    const characterUnits = getVisualCharacterUnits(character);

    if (nextUnits + characterUnits > maxUnits) {
      break;
    }

    nextText += character;
    nextUnits += characterUnits;
  }

  return nextText.trimEnd();
}

function getVisualTextUnits(value: string) {
  let units = 0;

  for (const character of value) {
    units += getVisualCharacterUnits(character);
  }

  return units;
}

function getVisualCharacterUnits(character: string) {
  if (/\s/u.test(character)) {
    return 0.3;
  }

  if (/[ilI.,:;!'|]/u.test(character)) {
    return 0.28;
  }

  if (/[mwMW@#%&]/u.test(character)) {
    return 0.84;
  }

  if (/[A-Z0-9]/u.test(character)) {
    return 0.66;
  }

  if (character.codePointAt(0)! > 0xffff) {
    return 1;
  }

  return 0.53;
}

function renderJoinPartyButton(copy: PartyShareCopy) {
  return `<div style="${PARTY_SHARE_IMAGE_STYLES.ctaButton}"><span style="${PARTY_SHARE_IMAGE_STYLES.ctaText}">${escapeHtmlText(copy.joinParty)}</span></div>`;
}

function renderFooterBrand(trizumMarkUrl: string, copy: PartyShareCopy) {
  const markSize = String(PARTY_SHARE_IMAGE_BRAND_MARK_SIZE);

  return [
    `<div style="${PARTY_SHARE_IMAGE_STYLES.footerBrand}">`,
    `<div style="${PARTY_SHARE_IMAGE_STYLES.viaText}">${escapeHtmlText(copy.via)}</div>`,
    `<div style="${PARTY_SHARE_IMAGE_STYLES.footerBrandMark}">`,
    `<img src="${escapeHtmlAttribute(trizumMarkUrl)}" width="${markSize}" height="${markSize}" />`,
    "</div>",
    `<div style="${PARTY_SHARE_IMAGE_STYLES.footerBrandName}">trizum</div>`,
    "</div>",
  ].join("");
}

function sanitizePlainText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return limitText(normalizePreviewText(value), maxLength);
}

function normalizePreviewText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function limitText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function createPreviewVersion(value: unknown) {
  const serializedValue = JSON.stringify(value);
  let hash = 2166136261;

  for (let index = 0; index < serializedValue.length; index += 1) {
    hash ^= serializedValue.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeHtmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function withHeader(headers: Headers, name: string, value: string) {
  const nextHeaders = new Headers(headers);

  nextHeaders.set(name, value);

  return nextHeaders;
}

function withVaryHeader(headers: Headers, value: string) {
  const nextHeaders = new Headers(headers);
  const existingValues = nextHeaders
    .get("Vary")
    ?.split(",")
    .map((headerValue) => headerValue.trim())
    .filter(Boolean);

  if (!existingValues?.some((headerValue) => headerValue.toLowerCase() === value.toLowerCase())) {
    nextHeaders.set("Vary", [...(existingValues ?? []), value].join(", "));
  }

  return nextHeaders;
}
