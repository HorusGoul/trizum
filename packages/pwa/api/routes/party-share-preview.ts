import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isValidDocumentId,
  Repo,
  type DocumentId,
  type PeerId,
} from "@automerge/automerge-repo/slim";
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket";
import interFontUrl from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import { Hono } from "hono";
import type { ApiEnv, ApiHonoEnv } from "../env";
import { getLogger } from "../../src/lib/log.js";

const logger = getLogger("api", "partySharePreview");

const DEFAULT_PARTY_SYMBOL = "\uD83C\uDFDD\uFE0F";
const DEFAULT_AUTOMERGE_WSS_URL = "wss://server.trizum.app/sync";
const DEFAULT_PREVIEW_TIMEOUT_MS = 1800;
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

const TRIZUM_MARK_SVG = `<svg width="128" height="128" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="104" fill="#050505"/><path d="M138.738 197.734H356.862C356.862 197.734 397.947 197.734 397.947 166.36C397.947 134.986 356.862 134.986 356.862 134.986C335.199 134.986 311.295 134.986 301.584 161.878M273.945 232.843C273.945 232.843 238.089 317.254 199.245 357.592C185.578 371.785 174.594 377.014 154.425 377.014C134.256 377.014 113.388 366.556 114.087 344.893C114.786 323.23 138.738 323.23 138.738 323.23H176.835M273.945 323.23H356.862" stroke="#FFFFFF" stroke-width="17.928" stroke-linecap="round"/></svg>`;
const TRIZUM_MARK_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  TRIZUM_MARK_SVG,
)}`;

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
    env: ApiEnv,
    request: Request,
  ) => Promise<Response> | Response;
  loadPreview?: (partyId: string, env: ApiEnv, request: Request) => Promise<PartySharePreview>;
}

interface PartyPreviewDocument {
  description?: unknown;
  name?: unknown;
  participants?: Record<string, PartyPreviewParticipant | undefined>;
  symbol?: unknown;
  type?: unknown;
}

interface PartyPreviewParticipant {
  isArchived?: boolean;
  name?: unknown;
}

let automergeWasm: Promise<void> | undefined;
let interFontData: Promise<ArrayBuffer> | undefined;
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
    const html = renderPartyShareImageHtml(preview);

    return await createImageResponse(html, c.env, c.req.raw);
  });

  route.all("/party/*", (c) => c.env.ASSETS.fetch(c.req.raw));

  return route;
}

async function createWorkersOgImageResponse(html: string, env: ApiEnv, request: Request) {
  const { ImageResponse } = await import("workers-og");
  const interFont = await loadInterFontData(env, request);

  return new ImageResponse(html, {
    emoji: "twemoji",
    format: "png",
    fonts: [
      {
        data: interFont,
        name: "Inter",
        style: "normal",
        weight: 400,
      },
    ],
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
  const fontUrl = new URL(interFontUrl, request.url);
  const response = await env.ASSETS.fetch(new Request(fontUrl));

  if (!response.ok) {
    throw new Error(`Could not load Inter font asset: ${response.status}`);
  }

  return response.arrayBuffer();
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
    ["meta", "property", "og:type", "website"],
    ["meta", "property", "og:site_name", "trizum"],
    ["meta", "property", "og:title", title],
    ["meta", "property", "og:description", description],
    ["meta", "property", "og:url", pageUrl],
    ["meta", "property", "og:image", imageUrl.toString()],
    ["meta", "property", "og:image:width", String(PARTY_SHARE_IMAGE_WIDTH)],
    ["meta", "property", "og:image:height", String(PARTY_SHARE_IMAGE_HEIGHT)],
    ["meta", "property", "og:image:alt", `${title} preview`],
    ["meta", "name", "twitter:card", "summary_large_image"],
    ["meta", "name", "twitter:title", title],
    ["meta", "name", "twitter:description", description],
    ["meta", "name", "twitter:image", imageUrl.toString()],
  ]
    .map(([tag, keyName, keyValue, content]) => {
      return `<${tag} ${keyName}="${escapeHtmlAttribute(keyValue)}" content="${escapeHtmlAttribute(
        content,
      )}" />`;
    })
    .join("\n    ");
}

export function renderPartyShareImageHtml(preview: PartySharePreview) {
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
            <img src="${TRIZUM_MARK_DATA_URI}" width="58" height="58" />
            <div style="display: flex; margin-left: 16px; font-size: 30px; font-weight: 760; letter-spacing: 0;">trizum</div>
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
                <div style="display: flex; max-width: 840px; font-size: 72px; font-weight: 820; line-height: 0.98; letter-spacing: 0;">${escapeHtmlText(
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
  participant: PartyPreviewParticipant | undefined,
): participant is PartyPreviewParticipant {
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
    logger.warning("Could not load party share preview", { error });
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

  const timeoutMs = getPreviewTimeoutMs(env);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  let repo: Repo | undefined;

  try {
    await initializeAutomerge();

    repo = new Repo({
      isEphemeral: true,
      network: [new BrowserWebSocketClientAdapter(getAutomergeWssUrl(env, request), 0)],
      peerId: `party-share-preview:${crypto.randomUUID()}` as PeerId,
      sharePolicy: () => Promise.resolve(false),
    });

    const handle = await repo.find<PartyPreviewDocument>(partyId as DocumentId, {
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
      logger.warning("Could not shut down party share preview repo", { error });
    });
  }
}

function initializeAutomerge() {
  automergeWasm ??= initializeBase64Wasm(automergeWasmBase64);
  return automergeWasm;
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
  return "display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-right: 10px; border-radius: 16px; background: #A7D8A2; color: #071007; font-size: 18px; font-weight: 760;";
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
