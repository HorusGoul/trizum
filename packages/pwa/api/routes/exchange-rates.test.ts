import { describe, expect, test, vi } from "vite-plus/test";
import { createExchangeRatesRoute } from "./exchange-rates";
import { getBundledExchangeRates } from "../../src/lib/exchangeRateTables";

function fixture(fetchRates: typeof fetch) {
  const entries = new Map<string, Response>();
  const pending: Promise<unknown>[] = [];

  const cache = {
    match: vi.fn<Cache["match"]>(async (request: RequestInfo | URL) =>
      entries.get(new Request(request).url)?.clone(),
    ),
    put: vi.fn<Cache["put"]>(async (request: RequestInfo | URL, response: Response) => {
      entries.set(new Request(request).url, response.clone());
    }),
  };

  const context = {
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
    passThroughOnException() {},
    props: {},
  };

  const app = createExchangeRatesRoute({ fetchRates, getCache: () => cache });

  return {
    cache,
    request: (url = "https://trizum.test/?base=EUR&unused=1") => app.request(url, {}, {}, context),
    pending,
  };
}

describe("exchange rates Worker", () => {
  test("normalizes upstream rates and serves repeated query variants from one cached entry", async () => {
    const fetchRates = vi.fn<typeof fetch>(async () =>
      Response.json([
        { base: "EUR", quote: "USD", rate: 1.2, date: "2026-11-06" },
        { base: "EUR", quote: "GBP", rate: 0.8, date: "2026-11-05" },
      ]),
    );

    const { request, cache, pending } = fixture(fetchRates);
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=21600");
    expect(await response.json()).toEqual({
      base: "EUR",
      rates: {
        EUR: { rate: 1, date: "2026-11-06" },
        USD: { rate: 1.2, date: "2026-11-06" },
        GBP: { rate: 0.8, date: "2026-11-05" },
      },
    });
    await Promise.all(pending);
    const cached = await request("https://trizum.test/?different=query&base=EUR");
    expect(cached.status).toBe(200);
    expect(cached.headers.get("cache-control")).toBe("public, max-age=21600");
    expect(fetchRates).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
    expect(fetchRates.mock.calls[0]?.[0]).toBe("https://api.frankfurter.dev/v2/rates?base=EUR");
  });

  test.each([null, [], [{ base: "EUR", quote: "USD", rate: -2, date: "2026-11-06" }]])(
    "serves bundled rates for malformed upstream data %s",
    async (body) => {
      const { request } = fixture(async () => Response.json(body));
      const response = await request();
      expect(await response.json()).toEqual(getBundledExchangeRates("EUR"));
      expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    },
  );

  test("serves bundled rates when the upstream request fails", async () => {
    const { request } = fixture(async () => {
      throw new Error("Network failure");
    });

    expect(await (await request()).json()).toEqual(getBundledExchangeRates("EUR"));
  });
});

test("fetches and caches tables separately for each party currency", async () => {
  const fetchRates = vi.fn<typeof fetch>(async (input) => {
    const base = new URL(new Request(input).url).searchParams.get("base");

    return Response.json([
      { base, quote: "JPY", rate: base === "USD" ? 150 : 180, date: "2026-11-06" },
    ]);
  });

  const { request, pending, cache } = fixture(fetchRates);
  const usd = await request("https://trizum.test/?base=USD");
  expect(await usd.json()).toEqual({
    base: "USD",
    rates: { USD: { rate: 1, date: "2026-11-06" }, JPY: { rate: 150, date: "2026-11-06" } },
  });
  const gbp = await request("https://trizum.test/?base=GBP");
  expect(await gbp.json()).toMatchObject({
    base: "GBP",
    rates: { GBP: { rate: 1 }, JPY: { rate: 180 } },
  });
  await Promise.all(pending);
  await request("https://trizum.test/?base=USD&extra=ignored");
  expect(fetchRates).toHaveBeenCalledTimes(2);
  expect(cache.put).toHaveBeenCalledTimes(2);
  expect(fetchRates.mock.calls.map(([url]) => new Request(url).url)).toEqual([
    "https://api.frankfurter.dev/v2/rates?base=USD",
    "https://api.frankfurter.dev/v2/rates?base=GBP",
  ]);
});

test.each(["", "?base=invalid", "?base=eur"])(
  "rejects missing or invalid party base %s before fetching",
  async (query) => {
    const fetchRates = vi.fn<typeof fetch>();
    const { request } = fixture(fetchRates);
    expect((await request(`https://trizum.test/${query}`)).status).toBe(400);
    expect(fetchRates).not.toHaveBeenCalled();
  },
);

test("rebases the offline fallback and rejects an upstream table with the wrong base", async () => {
  const { request } = fixture(async () =>
    Response.json([{ base: "EUR", quote: "USD", rate: 1.2, date: "2026-11-06" }]),
  );

  const response = await request("https://trizum.test/?base=GBP");
  expect(await response.json()).toEqual(getBundledExchangeRates("GBP"));
});
