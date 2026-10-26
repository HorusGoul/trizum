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

  it.each([undefined, null])("reconciles a missing customer when param is %s", async (param) => {
    const missing = {
      object: "error",
      type: "resource_missing",
      message: "Resource not found",
      retryable: false,
      doc_url: "https://errors.rev.cat/resource-missing",
      param,
    };
    const { client, fetcher } = setup(404, missing);
    fetcher
      .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
      .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ object: "list", items: [] }));
    await expect(client.requestCustomerDeletion(customer)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      [
        "https://api.revenuecat.com/v2/projects/project%2Fid/customers/user%2Fwith%20space",
        "DELETE",
      ],
      ["https://api.revenuecat.com/v2/projects/project%2Fid/customers/user%2Fwith%20space", "GET"],
      ["https://api.revenuecat.com/v2/projects/project%2Fid/customers?limit=1", "GET"],
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.signal).toBe(fetcher.mock.calls[0]?.[1]?.signal);
      expect(init?.headers).toEqual({
        Authorization: "Bearer test-secret",
        Accept: "application/json",
      });
    }
  });

  it.each<[number, unknown]>([
    [200, { object: "customer", id: customer.customerId }],
    [404, { type: "resource_missing", param: "project_id" }],
    [403, { type: "permissions_error" }],
    [503, { type: "server_error" }],
  ])("does not confirm absence for customer lookup status %s", async (status, body) => {
    const { client, fetcher } = setup(404, { type: "resource_missing" });
    fetcher
      .mockResolvedValueOnce(Response.json({ type: "resource_missing" }, { status: 404 }))
      .mockResolvedValueOnce(Response.json(body, { status }));
    await expect(client.requestCustomerDeletion(customer)).rejects.toThrow("not acknowledged");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each<[number, unknown]>([
    [404, { type: "resource_missing" }],
    [403, { type: "permissions_error" }],
    [503, { type: "server_error" }],
    [200, {}],
    [200, { object: "list", items: null }],
  ])("rejects unverified projects with status %s", async (status, body) => {
    const missing = { type: "resource_missing" };
    const { client, fetcher } = setup(404, missing);
    fetcher
      .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
      .mockResolvedValueOnce(Response.json(missing, { status: 404 }))
      .mockResolvedValueOnce(Response.json(body, { status }));
    await expect(client.requestCustomerDeletion(customer)).rejects.toThrow("not acknowledged");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("preserves the account boundary if reconciliation times out", async () => {
    const { client, fetcher } = setup(404, { type: "resource_missing" });
    fetcher
      .mockResolvedValueOnce(Response.json({ type: "resource_missing" }, { status: 404 }))
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    await expect(client.requestCustomerDeletion(customer)).rejects.toThrow(
      "could not be confirmed",
    );
  });

  it.each<[number, unknown]>([
    [404, { type: "resource_missing", param: "project_id" }],
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
