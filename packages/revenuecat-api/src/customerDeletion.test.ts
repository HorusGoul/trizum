import { describe, expect, it, vi } from "vite-plus/test";
import { createRevenueCatApiClient } from "./index.js";

const customer = { customerId: "user/with space", projectId: "project/id" };
const accepted = { object: "customer", id: customer.customerId, deleted_at: 123 };

function setup(status: number, body: unknown) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
  return { fetcher, client: createRevenueCatApiClient({ fetcher, secretApiKey: "test-secret" }) };
}

describe("RevenueCat customer deletion", () => {
  it("requests project-wide deletion with encoded IDs, server credentials, and a timeout", async () => {
    const { client, fetcher } = setup(200, accepted);
    await client.requestCustomerDeletion(customer);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      "https://api.revenuecat.com/v2/projects/project%2Fid/customers/user%2Fwith%20space",
      {
        method: "DELETE",
        headers: { Authorization: "Bearer test-secret", Accept: "application/json" },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("accepts a repeated request when only the customer is missing", async () => {
    const { client, fetcher } = setup(200, accepted);
    await client.requestCustomerDeletion(customer);
    fetcher.mockResolvedValueOnce(
      Response.json({ type: "resource_missing", param: "customer_id" }, { status: 404 }),
    );
    await expect(client.requestCustomerDeletion(customer)).resolves.toBeUndefined();
  });

  it.each<[number, unknown]>([
    [404, { type: "resource_missing", param: "project_id" }],
    [404, { type: "resource_missing" }],
    [200, {}],
    [200, { object: "customer", id: "user", deleted_at: null }],
    ...[401, 403, 409, 423, 429, 500, 503].map((status): [number, unknown] => [
      status,
      { message: "remote failure" },
    ]),
  ])("fails closed for status %s and body %j", async (status, body) => {
    const { client, fetcher } = setup(status, body);
    await expect(client.requestCustomerDeletion(customer)).rejects.toThrow("not acknowledged");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([new Error("network failure"), new DOMException("timeout", "TimeoutError")])(
    "does not confirm cleanup on transport failure",
    async (error) => {
      const { client, fetcher } = setup(200, accepted);
      fetcher.mockRejectedValueOnce(error);
      await expect(client.requestCustomerDeletion(customer)).rejects.toThrow(
        "could not be confirmed",
      );
    },
  );

  it("rejects malformed JSON without exposing the response body", async () => {
    const { client, fetcher } = setup(200, accepted);
    fetcher.mockResolvedValueOnce(new Response("sensitive upstream response"));
    await expect(client.requestCustomerDeletion(customer)).rejects.toThrow(
      "could not be confirmed",
    );
  });

  it.each([
    { ...customer, customerId: " " },
    { ...customer, projectId: "" },
  ])("rejects missing identifiers without a request", async (request) => {
    const { client, fetcher } = setup(200, accepted);
    await expect(client.requestCustomerDeletion(request)).rejects.toThrow(
      "identifiers are required",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
