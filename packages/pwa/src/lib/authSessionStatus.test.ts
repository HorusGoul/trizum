import { describe, expect, it } from "vite-plus/test";
import { getAuthSessionStatus } from "./authSessionStatus.ts";

describe("getAuthSessionStatus", () => {
  it("does not treat an offline cold start as a confirmed sign-out", () => {
    expect(
      getAuthSessionStatus({ data: null, error: new Error("offline"), isPending: false }),
    ).toBe("unavailable");
    expect(getAuthSessionStatus({ data: null, error: null, isPending: true })).toBe("pending");
  });

  it("recovers when reconnect verifies the session and recognizes a confirmed sign-out", () => {
    expect(
      getAuthSessionStatus({ data: { user: { id: "account-a" } }, error: null, isPending: false }),
    ).toBe("signed-in");
    expect(getAuthSessionStatus({ data: null, error: null, isPending: false })).toBe("signed-out");
  });

  it("does not use stale user data while authentication is uncertain", () => {
    const data = { user: { id: "account-a" } };
    expect(getAuthSessionStatus({ data, error: new Error("offline"), isPending: false })).toBe(
      "unavailable",
    );
    expect(getAuthSessionStatus({ data, error: null, isPending: true })).toBe("pending");
  });
});
