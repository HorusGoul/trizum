import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./generated/customerResources.gen.js";

const REVENUECAT_API_URL = "https://api.revenuecat.com/v2";
const PAGE_SIZE = 100;

type RevenueCatPurchasePage =
  paths["/projects/{project_id}/customers/{customer_id}/purchases"]["get"]["responses"][200]["content"]["application/json"];
type RevenueCatSubscriptionPage =
  paths["/projects/{project_id}/customers/{customer_id}/subscriptions"]["get"]["responses"][200]["content"]["application/json"];
type RevenueCatPurchase = RevenueCatPurchasePage["items"][number];
type RevenueCatSubscription = RevenueCatSubscriptionPage["items"][number];

interface RevenueCatPage<T> {
  items: T[];
  next_page: string | null;
}

export interface RevenueCatApiClient {
  hasDirectEntitlement(request: {
    customerId: string;
    entitlementLookupKey: string;
    projectId: string;
  }): Promise<boolean>;
}

export class RevenueCatApiError extends Error {
  override readonly name = "RevenueCatApiError";
}

export function createRevenueCatApiClient({
  fetcher = fetch,
  secretApiKey,
}: {
  fetcher?: typeof fetch;
  secretApiKey: string;
}): RevenueCatApiClient {
  if (!secretApiKey.trim()) {
    throw new RevenueCatApiError("A RevenueCat v2 secret API key is required.");
  }

  const client = createClient<paths>({
    baseUrl: REVENUECAT_API_URL,
    fetch: fetcher,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secretApiKey}`,
    },
  });

  return {
    async hasDirectEntitlement({ customerId, entitlementLookupKey, projectId }) {
      if (!customerId.trim() || !entitlementLookupKey.trim() || !projectId.trim()) {
        throw new RevenueCatApiError(
          "RevenueCat project, customer, and entitlement identifiers are required.",
        );
      }

      try {
        const [subscriptions, purchases] = await Promise.all([
          listAllRevenueCatResources((startingAfter) =>
            getSubscriptionsPage(client, { customerId, projectId, startingAfter }),
          ),
          listAllRevenueCatResources((startingAfter) =>
            getPurchasesPage(client, { customerId, projectId, startingAfter }),
          ),
        ]);

        if (!subscriptions || !purchases) {
          return false;
        }

        return (
          subscriptions.some((subscription) =>
            isEligibleSubscription(subscription, entitlementLookupKey),
          ) || purchases.some((purchase) => isEligiblePurchase(purchase, entitlementLookupKey))
        );
      } catch (error) {
        if (error instanceof RevenueCatApiError) {
          throw error;
        }

        throw new RevenueCatApiError("RevenueCat could not be reached.", { cause: error });
      }
    },
  };
}

interface PageRequest {
  customerId: string;
  projectId: string;
  startingAfter: string | undefined;
}

async function getSubscriptionsPage(
  client: Client<paths>,
  { customerId, projectId, startingAfter }: PageRequest,
): Promise<RevenueCatPage<RevenueCatSubscription> | null> {
  const { data, error, response } = await client.GET(
    "/projects/{project_id}/customers/{customer_id}/subscriptions",
    {
      params: {
        path: { customer_id: customerId, project_id: projectId },
        query: { limit: PAGE_SIZE, starting_after: startingAfter },
      },
    },
  );

  return parsePageResponse(data, error, response, "subscriptions");
}

async function getPurchasesPage(
  client: Client<paths>,
  { customerId, projectId, startingAfter }: PageRequest,
): Promise<RevenueCatPage<RevenueCatPurchase> | null> {
  const { data, error, response } = await client.GET(
    "/projects/{project_id}/customers/{customer_id}/purchases",
    {
      params: {
        path: { customer_id: customerId, project_id: projectId },
        query: { limit: PAGE_SIZE, starting_after: startingAfter },
      },
    },
  );

  return parsePageResponse(data, error, response, "purchases");
}

function parsePageResponse<T>(
  data: unknown,
  error: unknown,
  response: Response,
  resourceName: string,
): RevenueCatPage<T> | null {
  if (response.status === 404) {
    if (isMissingCustomerError(error)) {
      return null;
    }

    throw new RevenueCatApiError(
      `RevenueCat ${resourceName} request could not find the configured resource.`,
    );
  }

  if (!response.ok) {
    throw new RevenueCatApiError(
      `RevenueCat ${resourceName} request failed with status ${response.status}.`,
    );
  }

  assertRecord(data, `${resourceName} list`);
  if (
    !Array.isArray(data.items) ||
    (data.next_page !== null && typeof data.next_page !== "string")
  ) {
    throw new RevenueCatApiError(`RevenueCat returned an invalid ${resourceName} list.`);
  }

  return data as unknown as RevenueCatPage<T>;
}

function isMissingCustomerError(value: unknown) {
  return isRecord(value) && value.type === "resource_missing" && value.param === "customer_id";
}

async function listAllRevenueCatResources<T>(
  loadPage: (startingAfter: string | undefined) => Promise<RevenueCatPage<T> | null>,
): Promise<T[] | null> {
  const resources: T[] = [];
  const cursors = new Set<string>();
  let startingAfter: string | undefined;

  for (;;) {
    const page = await loadPage(startingAfter);
    if (!page) {
      return null;
    }

    resources.push(...page.items);
    if (!page.next_page) {
      return resources;
    }

    const nextCursor = new URL(page.next_page, REVENUECAT_API_URL).searchParams.get(
      "starting_after",
    );
    if (!nextCursor || cursors.has(nextCursor)) {
      throw new RevenueCatApiError("RevenueCat returned invalid resource pagination.");
    }

    cursors.add(nextCursor);
    startingAfter = nextCursor;
  }
}

function isEligibleSubscription(
  subscription: RevenueCatSubscription,
  entitlementLookupKey: string,
) {
  assertRecord(subscription, "subscription");
  if (
    typeof subscription.gives_access !== "boolean" ||
    typeof subscription.ownership !== "string"
  ) {
    throw new RevenueCatApiError("RevenueCat returned an invalid subscription.");
  }

  return (
    subscription.gives_access &&
    subscription.ownership === "purchased" &&
    hasActiveEntitlement(subscription.entitlements, entitlementLookupKey)
  );
}

function isEligiblePurchase(purchase: RevenueCatPurchase, entitlementLookupKey: string) {
  assertRecord(purchase, "purchase");
  if (typeof purchase.status !== "string" || typeof purchase.ownership !== "string") {
    throw new RevenueCatApiError("RevenueCat returned an invalid purchase.");
  }

  return (
    purchase.status === "owned" &&
    purchase.ownership === "purchased" &&
    hasActiveEntitlement(purchase.entitlements, entitlementLookupKey)
  );
}

function hasActiveEntitlement(value: unknown, entitlementLookupKey: string) {
  assertRecord(value, "entitlements");
  if (!Array.isArray(value.items)) {
    throw new RevenueCatApiError("RevenueCat returned invalid entitlements.");
  }

  return value.items.some((entitlement: unknown) => {
    assertRecord(entitlement, "entitlement");
    if (typeof entitlement.lookup_key !== "string" || typeof entitlement.state !== "string") {
      throw new RevenueCatApiError("RevenueCat returned an invalid entitlement.");
    }

    return entitlement.lookup_key === entitlementLookupKey && entitlement.state === "active";
  });
}

function assertRecord(
  value: unknown,
  resourceName: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new RevenueCatApiError(`RevenueCat returned an invalid ${resourceName}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
