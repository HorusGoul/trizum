import { generateAutomergeUrl, parseAutomergeUrl } from "@automerge/automerge-repo/slim";
import { Hono } from "hono";
import { describe, expect, test, vi } from "vite-plus/test";
import type { ApiEnv, ApiHonoEnv } from "../env";
import {
  createPartySharePreviewFromParty,
  createPartySharePreviewRoute,
  injectPartyShareHeadTags,
  isPartyPreviewRequest,
  renderPartyShareImageHtml,
  renderPartyShareHeadTags,
  resolvePartyShareLocale,
  type PartySharePreview,
} from "./party-share-preview";

type AssetFetch = (request: Request) => Promise<Response>;
type LoadPreview = (partyId: string, env: ApiEnv, request: Request) => Promise<PartySharePreview>;

describe("party share preview crawler detection", () => {
  test("detects known preview crawlers requesting HTML", () => {
    const request = new Request(createPartyUrl(), {
      headers: {
        Accept: "text/html",
        "User-Agent": "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      },
    });

    expect(isPartyPreviewRequest(request)).toBe(true);
  });

  test("does not treat regular browser navigations as preview crawlers", () => {
    const request = new Request(createPartyUrl(), {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      },
    });

    expect(isPartyPreviewRequest(request)).toBe(false);
  });

  test("supports a query override for manual preview testing", () => {
    const request = new Request(`${createPartyUrl()}?preview=1`, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0",
      },
    });

    expect(isPartyPreviewRequest(request)).toBe(true);
  });
});

describe("party share preview metadata", () => {
  test("injects escaped share metadata before the head closes", () => {
    const preview = createPreview({
      description: "Dinner < drinks",
      name: "Lisbon & Porto",
      symbol: "<>",
    });
    const tags = renderPartyShareHeadTags({
      partyId: createDocumentId(),
      preview,
      requestUrl: new URL("https://trizum.app/party/example?preview=1"),
    });
    const html = injectPartyShareHeadTags("<html><head><title>trizum</title></head></html>", tags);

    expect(html).toContain("<title>Join Lisbon &amp; Porto on trizum</title>");
    expect(html).not.toContain("<title>trizum</title>");
    expect(html).toContain(
      'name="description" content="Dinner &lt; drinks Open this party to split expenses and settle up together on trizum."',
    );
    expect(html).toContain('property="og:title" content="Join Lisbon &amp; Porto on trizum"');
    expect(html).toContain(
      'property="og:description" content="Dinner &lt; drinks Open this party to split expenses and settle up together on trizum."',
    );
    expect(html).toContain('property="og:url" content="https://trizum.app/party/');
    expect(html).toContain("lang=en");
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).not.toContain("Alice");
    expect(html.indexOf('property="og:title"')).toBeLessThan(html.indexOf("</head>"));
  });

  test("renders Spanish metadata when the share URL carries a Spanish locale", () => {
    const preview = createPreview({
      description: "Cena compartida",
      name: "Viaje a Lisboa",
    });
    const tags = renderPartyShareHeadTags({
      locale: "es",
      partyId: createDocumentId(),
      preview,
      requestUrl: new URL("https://trizum.app/party/example?lang=es"),
    });

    expect(tags).toContain("<title>Únete a Viaje a Lisboa en trizum</title>");
    expect(tags).toContain(
      'property="og:description" content="Cena compartida Abre este grupo para dividir gastos y saldar cuentas juntos en trizum."',
    );
    expect(tags).toContain("lang=es");
    expect(tags).toContain(
      'property="og:image:alt" content="Vista previa de Únete a Viaje a Lisboa en trizum"',
    );
  });

  test("builds preview data from shareable party fields only", () => {
    const preview = createPartySharePreviewFromParty({
      description: "Beach house costs",
      name: "Summer Trip",
      symbol: "S",
      type: "party",
    });

    expect(preview).toMatchObject({
      description: "Beach house costs",
      name: "Summer Trip",
      symbol: "S",
    });
  });
});

describe("party share preview image", () => {
  test("renders invite-focused action copy without participants", () => {
    const html = renderPartyShareImageHtml(
      createPreview({
        description:
          "This description is intentionally long enough to be truncated inside the generated image preview without moving the footer action row around.",
        name: "This is an intentionally long party title that should be bounded inside one line",
      }),
      { trizumMarkUrl: "/maskable.svg" },
    );

    expect(html).toContain("Join party");
    expect(html).toContain("via");
    expect(html).toContain("trizum");
    expect(html).toContain("This description is intentionally long enough to");
    expect(html).toContain("be truncated inside the generated image previ...");
    expect(html).toContain("...");
    expect(html).not.toContain("Shared expense invite");
    expect(html).not.toContain("Open in trizum");
  });

  test("renders Spanish image copy", () => {
    const html = renderPartyShareImageHtml(createPreview({ description: "" }), {
      locale: "es",
      trizumMarkUrl: "/maskable.svg",
    });

    expect(html).toContain("Unirse");
    expect(html).toContain("vía");
    expect(html).toContain("Divide gastos y salda cuentas juntos en trizum.");
    expect(html).not.toContain("Join party");
    expect(html).not.toContain("Split expenses and settle up together on trizum.");
  });
});

describe("party share preview locale resolution", () => {
  test("prefers an explicit share URL locale over Accept-Language", () => {
    const request = new Request(`${createPartyUrl()}?lang=es`, {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    expect(resolvePartyShareLocale(request)).toBe("es");
  });

  test("falls back to the best supported Accept-Language locale", () => {
    const request = new Request(createPartyUrl(), {
      headers: {
        "Accept-Language": "fr-FR,es-ES;q=0.9,en;q=0.8",
      },
    });

    expect(resolvePartyShareLocale(request)).toBe("es");
  });
});

describe("party share preview route", () => {
  test("delegates normal party navigations to static assets without loading preview data", async () => {
    const assetFetch = vi.fn<AssetFetch>(
      async () => new Response("<html><head></head><body>app</body></html>"),
    );
    const loadPreview = vi.fn<LoadPreview>(async () => createPreview());
    const app = createTestApp(assetFetch, loadPreview);

    const response = await app.request(
      createPartyUrl(),
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "Mozilla/5.0",
        },
      },
      createEnv(assetFetch),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html><head></head><body>app</body></html>");
    expect(assetFetch).toHaveBeenCalledTimes(1);
    expect(loadPreview).not.toHaveBeenCalled();
  });

  test("injects metadata for party preview crawlers", async () => {
    const assetFetch = vi.fn<AssetFetch>(
      async () => new Response("<html><head></head><body>app</body></html>"),
    );
    const loadPreview = vi.fn<LoadPreview>(async () =>
      createPreview({
        description: "Weekend costs",
        name: "Cabin",
        symbol: "C",
      }),
    );
    const app = createTestApp(assetFetch, loadPreview);

    const response = await app.request(
      createPartyUrl(),
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "Discordbot/2.0",
        },
      },
      createEnv(assetFetch),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('property="og:title" content="Join Cabin on trizum"');
    expect(html).toContain(
      'property="og:description" content="Weekend costs Open this party to split expenses and settle up together on trizum."',
    );
    expect(html).toContain('property="og:image" content="https://trizum.app/api/og/party/');
    expect(html).toContain("lang=en");
    expect(loadPreview).toHaveBeenCalledTimes(1);
  });

  test("injects localized metadata for party preview crawlers", async () => {
    const assetFetch = vi.fn<AssetFetch>(
      async () => new Response("<html><head></head><body>app</body></html>"),
    );
    const loadPreview = vi.fn<LoadPreview>(async () =>
      createPreview({
        description: "Costes del fin de semana",
        name: "Cabaña",
        symbol: "C",
      }),
    );
    const app = createTestApp(assetFetch, loadPreview);

    const response = await app.request(
      `${createPartyUrl()}?lang=es`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "Discordbot/2.0",
        },
      },
      createEnv(assetFetch),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Vary")).toContain("Accept-Language");
    expect(html).toContain('property="og:title" content="Únete a Cabaña en trizum"');
    expect(html).toContain(
      'property="og:description" content="Costes del fin de semana Abre este grupo para dividir gastos y saldar cuentas juntos en trizum."',
    );
    expect(html).toContain("lang=es");
  });

  test("serves generated image responses through the image route", async () => {
    const assetFetch = vi.fn<AssetFetch>(async () => new Response("asset"));
    const loadPreview = vi.fn<LoadPreview>(async () => createPreview({ name: "Cabin" }));
    const app = new Hono<ApiHonoEnv>();

    app.route(
      "/",
      createPartySharePreviewRoute({
        createImageResponse: (html) =>
          new Response(html, {
            headers: { "Content-Type": "text/html" },
          }),
        loadPreview,
      }),
    );

    const response = await app.request(
      `https://trizum.app/api/og/party/${createDocumentId()}`,
      {},
      createEnv(assetFetch),
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(html).toContain("Cabin");
    expect(html).toContain("trizum");
    expect(html).toContain('src="data:image/svg+xml;charset=utf-8,asset"');
  });
});

function createTestApp(assetFetch: AssetFetch, loadPreview: LoadPreview) {
  const app = new Hono<ApiHonoEnv>();

  app.route("/", createPartySharePreviewRoute({ loadPreview }));

  return app;
}

function createEnv(assetFetch: AssetFetch) {
  return {
    ASSETS: {
      fetch: assetFetch,
    },
  } as unknown as { Bindings: ApiEnv };
}

function createPartyUrl() {
  return `https://trizum.app/party/${createDocumentId()}`;
}

function createDocumentId() {
  return parseAutomergeUrl(generateAutomergeUrl()).documentId;
}

function createPreview(overrides: Partial<PartySharePreview> = {}): PartySharePreview {
  return {
    description: "Split expenses together.",
    isFallback: false,
    name: "Shared expenses",
    symbol: "S",
    version: "test-version",
    ...overrides,
  };
}
