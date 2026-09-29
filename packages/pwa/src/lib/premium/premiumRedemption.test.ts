import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  detectRedemptionPlatform,
  finishPremiumRedemption,
  getStoreRedemptionUrl,
  hasPendingPremiumRedemption,
  parseRedemptionSearch,
  rememberPremiumRedemption,
} from "./premiumRedemption.ts";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("store redemption links", () => {
  it("retains only a supported store when returning from sign-in", () => {
    expect(parseRedemptionSearch({ code: " FRIENDS ", store: "android" })).toEqual({
      code: "FRIENDS",
      store: "android",
    });
    expect(parseRedemptionSearch({ code: "FRIENDS", store: "ios" })).toEqual({
      code: "FRIENDS",
      store: "ios",
    });
  });
  it("targets trizum's Apple offer-code redemption and encodes the whole code", () => {
    const url = new URL(getStoreRedemptionUrl("ios", " FRIENDS&redirect=https://evil.test "));
    expect(url.origin + url.pathname).toBe("https://apps.apple.com/redeem");
    expect(url.searchParams.get("id")).toBe("6755971747");
    expect(url.searchParams.get("ctx")).toBe("offercodes");
    expect(url.searchParams.get("code")).toBe("FRIENDS&redirect=https://evil.test");
    expect(url.searchParams.has("redirect")).toBe(false);
  });
  it("uses the Google Play one-time-code link", () => {
    expect(getStoreRedemptionUrl("android", " FRIENDS ")).toBe(
      "https://play.google.com/redeem?code=FRIENDS",
    );
  });
  it("does not forward arbitrary destinations from branded links", () => {
    expect(
      parseRedemptionSearch({ store: "https://evil.test", code: ["x"], next: "https://evil.test" }),
    ).toEqual({ code: "" });
    expect(parseRedemptionSearch({ store: "apple", code: " FRIENDS " })).toEqual({
      code: "FRIENDS",
    });
  });
});

describe("pending redemption recovery", () => {
  it("binds sync to the initiating account and survives a module reload", async () => {
    rememberPremiumRedemption("friend");
    vi.resetModules();
    const reloaded = await import("./premiumRedemption.ts");
    expect(reloaded.hasPendingPremiumRedemption("friend")).toBe(true);
    expect(reloaded.hasPendingPremiumRedemption("other")).toBe(false);
    finishPremiumRedemption("other");
    expect(hasPendingPremiumRedemption("friend")).toBe(true);
    finishPremiumRedemption("friend");
    expect(hasPendingPremiumRedemption("friend")).toBe(false);
  });
  it("stops retrying cancelled or abandoned redemptions", () => {
    vi.useFakeTimers();
    rememberPremiumRedemption("friend");
    vi.advanceTimersByTime(15 * 60_000);
    expect(hasPendingPremiumRedemption("friend")).toBe(false);
  });
  it("ignores malformed or inaccessible stored state", () => {
    localStorage.setItem("trizum:pending-premium-redemption:v1", "invalid");
    expect(hasPendingPremiumRedemption("friend")).toBe(false);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });
    expect(hasPendingPremiumRedemption("friend")).toBe(false);
  });
});

describe("redemption OS detection", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 0, "ios"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", 5, "ios"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5, "ios"],
    ["Mozilla/5.0 (Linux; Android 16)", 5, "android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 0, undefined],
    ["Mozilla/5.0 (Windows NT 10.0)", 10, undefined],
    ["", 0, undefined],
  ])("detects %s with %s touch points", (userAgent, maxTouchPoints, expected) => {
    expect(detectRedemptionPlatform(userAgent, maxTouchPoints)).toBe(expected);
  });
});
