import { isValidDocumentId, Repo, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import { Hono } from "hono";
import type { ApiEnv, ApiHonoEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";
import { DEFAULT_PARTY_SYMBOL, type Party } from "../../src/models/party.js";

const logger = getLogger("api", "partySharePreview");

const DEFAULT_AUTOMERGE_WSS_URL = "wss://server.trizum.app/sync";
const DEFAULT_PREVIEW_TIMEOUT_MS = 10_000;
const PREVIEW_CACHE_SUCCESS_TTL_MS = 60_000;
const PREVIEW_CACHE_FALLBACK_TTL_MS = 5_000;
const MAX_DESCRIPTION_LENGTH = 180;
const MAX_IMAGE_DESCRIPTION_LENGTH = 210;
const MAX_MEMBER_NAME_LENGTH = 34;
const MAX_MEMBER_NAMES = 12;
const MAX_IMAGE_MEMBER_NAMES = 8;
const PARTY_SHARE_IMAGE_WIDTH = 1200;
const PARTY_SHARE_IMAGE_HEIGHT = 630;
const PARTY_SHARE_IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const INTER_FONT_FACES = [
  { path: "/assets/inter/Inter-Regular.ttf", weight: 400 },
  { path: "/assets/inter/Inter-Bold.ttf", weight: 700 },
  { path: "/assets/inter/Inter-ExtraBold.ttf", weight: 800 },
] as const;
const TRIZUM_MARK_PATH = "/maskable.svg";

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
  memberCount: number;
  memberNames: string[];
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

type PartyPreviewDocument = Pick<
  Party,
  "description" | "name" | "participants" | "symbol" | "type"
>;

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
    const preview = await loadPreview(partyId, c.env, request);
    const metaTags = renderPartyShareMetaTags({
      partyId,
      preview,
      requestUrl: new URL(request.url),
    });

    return new Response(injectPartyShareMetaTags(html, metaTags), {
      headers: withHeader(assetResponse.headers, "Content-Type", "text/html; charset=utf-8"),
      status: assetResponse.status,
      statusText: assetResponse.statusText,
    });
  });

  route.get("/api/og/party/:partyId", async (c) => {
    const partyId = c.req.param("partyId");
    const preview = await loadPreview(partyId, c.env, c.req.raw);
    const trizumMarkUrl = await loadTrizumMarkDataUrl(c.env, c.req.raw).catch((error) => {
      logger.warning("Could not load trizum mark for party share preview: {errorMessage}", {
        error: getErrorDetails(error),
        errorMessage: getErrorMessage(error),
      });

      return getPublicAssetUrl(c.req.raw, TRIZUM_MARK_PATH);
    });
    const html = renderPartyShareImageHtml(preview, {
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

export function injectPartyShareMetaTags(html: string, metaTags: string) {
  if (html.includes("</head>")) {
    return html.replace("</head>", `${metaTags}\n  </head>`);
  }

  return `${metaTags}\n${html}`;
}

export function renderPartyShareMetaTags({
  partyId,
  preview,
  requestUrl,
}: {
  partyId: string;
  preview: PartySharePreview;
  requestUrl: URL;
}) {
  const pageUrl = new URL(`/party/${encodeURIComponent(partyId)}`, requestUrl.origin).toString();
  const imageUrl = new URL(`/api/og/party/${encodeURIComponent(partyId)}`, requestUrl.origin);

  imageUrl.searchParams.set("v", preview.version);

  const title = getPartyShareTitle(preview);
  const description = getPartyShareDescription(preview);

  return [
    propertyMeta("og:type", "website"),
    propertyMeta("og:site_name", "trizum"),
    propertyMeta("og:title", title),
    propertyMeta("og:description", description),
    propertyMeta("og:url", pageUrl),
    propertyMeta("og:image", imageUrl.toString()),
    propertyMeta("og:image:width", String(PARTY_SHARE_IMAGE_WIDTH)),
    propertyMeta("og:image:height", String(PARTY_SHARE_IMAGE_HEIGHT)),
    propertyMeta("og:image:alt", `${title} preview`),
    nameMeta("twitter:card", "summary_large_image"),
    nameMeta("twitter:title", title),
    nameMeta("twitter:description", description),
    nameMeta("twitter:image", imageUrl.toString()),
  ]
    .map(renderSocialMetaTag)
    .join("\n    ");
}

export function renderPartyShareImageHtml(
  preview: PartySharePreview,
  options: { trizumMarkUrl?: string } = {},
) {
  const trizumMarkUrl = options.trizumMarkUrl ?? TRIZUM_MARK_PATH;
  const description = limitText(
    preview.description || getPartyShareDescription(preview),
    MAX_IMAGE_DESCRIPTION_LENGTH,
  );
  const memberNames = preview.memberNames.slice(0, MAX_IMAGE_MEMBER_NAMES);
  const remainingMemberCount = Math.max(preview.memberCount - memberNames.length, 0);
  const members =
    memberNames.length > 0
      ? [
          ...memberNames.map((memberName) => renderMemberPill(memberName)),
          remainingMemberCount > 0 ? renderMoreMembersPill(remainingMemberCount) : "",
        ].join("")
      : `<div style="${memberPillStyle()}"><span style="font-size: 24px; color: #C9D4C5;">Open invite</span></div>`;

  return `
    <div style="display: flex; width: 1200px; height: 630px; padding: 54px; font-family: Inter, sans-serif; color: #F7F9F4; background: #050505;">
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; border: 2px solid #263227; border-radius: 32px; background: #101410; overflow: hidden;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 34px 40px 0 40px;">
          <div style="display: flex; align-items: center;">
            <img src="${escapeHtmlAttribute(trizumMarkUrl)}" width="58" height="58" />
            <div style="display: flex; margin-left: 16px; font-size: 30px; font-weight: 700; letter-spacing: 0;">trizum</div>
          </div>
          <div style="display: flex; font-size: 24px; color: #A7D8A2;">Party invite</div>
        </div>

        <div style="display: flex; flex: 1; padding: 48px 56px 44px 56px;">
          <div style="display: flex; flex-direction: column; flex: 1;">
            <div style="display: flex; align-items: center;">
              <div style="display: flex; align-items: center; justify-content: center; width: 98px; height: 98px; border-radius: 30px; background: #EAF7E8; color: #050505; font-size: 58px; line-height: 1;">${escapeHtmlText(
                preview.symbol,
              )}</div>
              <div style="display: flex; flex-direction: column; margin-left: 28px;">
                <div style="display: flex; max-width: 840px; font-size: 72px; font-weight: 800; line-height: 0.98; letter-spacing: 0;">${escapeHtmlText(
                  preview.name,
                )}</div>
              </div>
            </div>

            <div style="display: flex; max-width: 960px; margin-top: 34px; font-size: 34px; line-height: 1.28; color: #D8E2D4;">${escapeHtmlText(
              description,
            )}</div>

            <div style="display: flex; flex-wrap: wrap; align-items: center; margin-top: 38px; gap: 14px;">
              ${members}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function createPartySharePreviewFromParty(party: PartyPreviewDocument): PartySharePreview {
  const activeParticipants = Object.values(party.participants ?? {}).filter(isActiveParticipant);
  const memberNames = activeParticipants
    .map((participant) => sanitizePlainText(participant.name, MAX_MEMBER_NAME_LENGTH))
    .filter((name) => name.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_MEMBER_NAMES);
  const memberCount = activeParticipants.length;
  const name = sanitizePlainText(party.name, 72) || "Shared expenses";
  const description = sanitizePlainText(party.description, MAX_DESCRIPTION_LENGTH);
  const symbol = sanitizePlainText(party.symbol, 8) || DEFAULT_PARTY_SYMBOL;

  return {
    description,
    isFallback: false,
    memberCount,
    memberNames,
    name,
    symbol,
    version: createPreviewVersion({ description, memberCount, memberNames, name, symbol }),
  };
}

function isActiveParticipant(
  participant: PartyPreviewDocument["participants"][string] | undefined,
): participant is PartyPreviewDocument["participants"][string] {
  return Boolean(participant && !participant.isArchived);
}

export function createFallbackPartySharePreview(): PartySharePreview {
  const preview = {
    description: "Split bills with friends, family, and roommates.",
    isFallback: true,
    memberCount: 0,
    memberNames: [],
    name: "Shared expenses",
    symbol: DEFAULT_PARTY_SYMBOL,
  };

  return {
    ...preview,
    version: createPreviewVersion(preview),
  };
}

async function getPartySharePreview(partyId: string, env: ApiEnv, request: Request) {
  const cacheKey = `${getAutomergeWssUrl(env, request)}:${partyId}`;
  const cachedPreview = previewCache.get(cacheKey);

  if (cachedPreview && cachedPreview.expiresAt > Date.now()) {
    return cachedPreview.preview;
  }

  const preview = await loadPartySharePreviewFromAutomerge(partyId, env, request).catch((error) => {
    logger.warning("Could not load party share preview: {errorMessage}", {
      error: getErrorDetails(error),
      errorMessage: getErrorMessage(error),
    });
    return createFallbackPartySharePreview();
  });
  const ttl = preview.isFallback ? PREVIEW_CACHE_FALLBACK_TTL_MS : PREVIEW_CACHE_SUCCESS_TTL_MS;

  previewCache.set(cacheKey, {
    expiresAt: Date.now() + ttl,
    preview,
  });

  return preview;
}

async function loadPartySharePreviewFromAutomerge(partyId: string, env: ApiEnv, request: Request) {
  if (!isValidDocumentId(partyId)) {
    return createFallbackPartySharePreview();
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
      return createFallbackPartySharePreview();
    }

    return createPartySharePreviewFromParty(party);
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

function getPartyShareTitle(preview: PartySharePreview) {
  return `Join ${preview.name} on trizum`;
}

function getPartyShareDescription(preview: PartySharePreview) {
  const description = preview.description || "Split expenses and settle up together.";
  const members = formatMembersSummary(preview);

  return limitText(members ? `${description} Members: ${members}.` : description, 240);
}

function formatMembersSummary(preview: PartySharePreview) {
  if (preview.memberNames.length === 0) {
    return "";
  }

  const names = preview.memberNames.slice(0, 4);
  const remainingCount = Math.max(preview.memberCount - names.length, 0);
  const summary = names.join(", ");

  return remainingCount > 0 ? `${summary}, +${remainingCount} more` : summary;
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

function renderMemberPill(memberName: string) {
  const initial = memberName.trim().charAt(0).toUpperCase() || "?";

  return `<div style="${memberPillStyle()}"><span style="${memberInitialStyle()}">${escapeHtmlText(
    initial,
  )}</span><span style="font-size: 24px; color: #F7F9F4;">${escapeHtmlText(
    memberName,
  )}</span></div>`;
}

function renderMoreMembersPill(memberCount: number) {
  return `<div style="${memberPillStyle()}"><span style="font-size: 24px; color: #C9D4C5;">+${memberCount} more</span></div>`;
}

function memberPillStyle() {
  return "display: flex; align-items: center; height: 54px; padding: 0 18px; border-radius: 27px; background: #1F271F; border: 1px solid #384638;";
}

function memberInitialStyle() {
  return "display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-right: 10px; border-radius: 16px; background: #A7D8A2; color: #071007; font-size: 18px; font-weight: 700;";
}

function sanitizePlainText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return limitText(value.replace(/\s+/g, " ").trim(), maxLength);
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
