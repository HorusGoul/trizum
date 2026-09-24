import { describe, expect, it } from "vite-plus/test";
import { createRevenueCatApiClient, RevenueCatApiError } from "./index.js";

describe("RevenueCatApiClient", () => {
  it("accepts a directly purchased active subscription", async () => {
    await expect(
      hasPremium({ subscriptions: [[createSubscription({ givesAccess: true })]] }),
    ).resolves.toBe(true);
  });

  it("accepts a directly purchased subscription in billing grace", async () => {
    await expect(
      hasPremium({
        subscriptions: [[createSubscription({ givesAccess: true, status: "in_grace_period" })]],
      }),
    ).resolves.toBe(true);
  });

  it("rejects a subscription in billing retry without access", async () => {
    await expect(
      hasPremium({
        subscriptions: [[createSubscription({ givesAccess: false, status: "in_billing_retry" })]],
      }),
    ).resolves.toBe(false);
  });

  it("rejects a family-shared subscription", async () => {
    await expect(
      hasPremium({
        subscriptions: [[createSubscription({ givesAccess: true, ownership: "family_shared" })]],
      }),
    ).resolves.toBe(false);
  });

  it("accepts a directly purchased lifetime product", async () => {
    await expect(hasPremium({ purchases: [[createPurchase({ status: "owned" })]] })).resolves.toBe(
      true,
    );
  });

  it("rejects a refunded lifetime product", async () => {
    await expect(
      hasPremium({ purchases: [[createPurchase({ status: "refunded" })]] }),
    ).resolves.toBe(false);
  });

  it("accepts a direct lifetime product alongside a family-shared subscription", async () => {
    await expect(
      hasPremium({
        purchases: [[createPurchase({ status: "owned" })]],
        subscriptions: [[createSubscription({ givesAccess: true, ownership: "family_shared" })]],
      }),
    ).resolves.toBe(true);
  });

  it("checks every page of RevenueCat resources", async () => {
    await expect(
      hasPremium({
        subscriptions: [
          [createSubscription({ givesAccess: false, id: "first" })],
          [createSubscription({ givesAccess: true, id: "second" })],
        ],
      }),
    ).resolves.toBe(true);
  });

  it("rejects an invalid pagination cursor", async () => {
    await expect(
      hasPremium({
        invalidPagination: true,
        subscriptions: [[createSubscription({ givesAccess: false })], []],
      }),
    ).rejects.toBeInstanceOf(RevenueCatApiError);
  });

  it("treats a missing customer as inactive without creating one", async () => {
    const requests: Request[] = [];

    await expect(hasPremium({ missingCustomer: true, requests })).resolves.toBe(false);
    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.method)).toEqual(["GET", "GET"]);
    expect(
      requests.every((request) => request.headers.get("Authorization") === "Bearer secret"),
    ).toBe(true);
  });

  it("does not interpret an upstream failure as inactive access", async () => {
    await expect(hasPremium({ subscriptionStatus: 503 })).rejects.toBeInstanceOf(
      RevenueCatApiError,
    );
  });

  it("requires all v2 credentials and identifiers", async () => {
    expect(() => createRevenueCatApiClient({ secretApiKey: "" })).toThrow(RevenueCatApiError);

    const client = createRevenueCatApiClient({ secretApiKey: "secret" });
    await expect(
      client.hasDirectEntitlement({
        customerId: "person",
        entitlementLookupKey: "premium",
        projectId: "",
      }),
    ).rejects.toBeInstanceOf(RevenueCatApiError);
  });
});

interface FetcherOptions {
  invalidPagination?: boolean;
  missingCustomer?: boolean;
  purchases?: unknown[][];
  requests?: Request[];
  subscriptions?: unknown[][];
  subscriptionStatus?: number;
}

function hasPremium(options: FetcherOptions) {
  return createRevenueCatApiClient({
    fetcher: createFetcher(options),
    secretApiKey: "secret",
  }).hasDirectEntitlement({
    customerId: "person",
    entitlementLookupKey: "premium",
    projectId: "project",
  });
}

function createFetcher({
  invalidPagination = false,
  missingCustomer = false,
  purchases = [[]],
  requests,
  subscriptions = [[]],
  subscriptionStatus = 200,
}: FetcherOptions): typeof fetch {
  return async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests?.push(request);

    if (missingCustomer) {
      return createJsonResponse({ object: "error" }, 404);
    }

    const url = new URL(request.url);
    const isSubscriptions = url.pathname.endsWith("/subscriptions");
    if (isSubscriptions && subscriptionStatus !== 200) {
      return createJsonResponse({ object: "error" }, subscriptionStatus);
    }

    const pages = isSubscriptions ? subscriptions : purchases;
    const pageIndex = url.searchParams.has("starting_after") ? 1 : 0;
    const items = pages[pageIndex] ?? [];
    const nextPage =
      pageIndex + 1 < pages.length
        ? `${url.pathname}${invalidPagination ? "" : "?starting_after=next"}`
        : null;

    return createJsonResponse({ items, next_page: nextPage, object: "list", url: url.pathname });
  };
}

function createJsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function createEntitlements() {
  return {
    items: [{ lookup_key: "premium", state: "active" }],
    next_page: null,
    object: "list",
    url: "/entitlements",
  };
}

function createSubscription({
  givesAccess,
  id = "subscription",
  ownership = "purchased",
  status = "active",
}: {
  givesAccess: boolean;
  id?: string;
  ownership?: "family_shared" | "purchased";
  status?: string;
}) {
  return {
    entitlements: createEntitlements(),
    gives_access: givesAccess,
    id,
    ownership,
    status,
  };
}

function createPurchase({
  ownership = "purchased",
  status,
}: {
  ownership?: "family_shared" | "purchased";
  status: "owned" | "refunded";
}) {
  return {
    entitlements: createEntitlements(),
    id: "purchase",
    ownership,
    status,
  };
}
