import { describe, expect, it } from "vite-plus/test";
import {
  AD_SESSION_GAP_MS,
  APP_OPEN_AD_MAX_AGE_MS,
  FULL_SCREEN_AD_COOLDOWN_MS,
  createAdHistory,
  isFullScreenAdCoolingDown,
  isPreparedAppOpenFresh,
  isProtectedAdRoute,
  parseAdHistory,
  recordFullScreenAdShown,
  resumeAdHistory,
  suspendAdHistory,
} from "./advertisingPolicy.ts";

describe("advertising policy", () => {
  it("keeps the first observed session ad-free", () => {
    const history = createAdHistory();
    const suspended = suspendAdHistory(history, 1_000);

    expect(resumeAdHistory(suspended, 1_000 + AD_SESSION_GAP_MS - 1)).toEqual({
      history,
      startedNewSession: false,
    });
  });

  it("completes first use after thirty minutes of inactivity", () => {
    const suspended = suspendAdHistory(createAdHistory(), 1_000);
    const result = resumeAdHistory(suspended, 1_000 + AD_SESSION_GAP_MS);

    expect(result.startedNewSession).toBe(true);
    expect(result.history.firstUseCompleted).toBe(true);
  });

  it("shares one cooldown across full-screen formats", () => {
    const shownAt = 10_000;
    const history = recordFullScreenAdShown(
      { ...createAdHistory(), firstUseCompleted: true },
      shownAt,
    );

    expect(isFullScreenAdCoolingDown(history, shownAt + FULL_SCREEN_AD_COOLDOWN_MS - 1)).toBe(true);
    expect(isFullScreenAdCoolingDown(history, shownAt + FULL_SCREEN_AD_COOLDOWN_MS)).toBe(false);
  });

  it("expires prepared app-open ads after four hours", () => {
    expect(isPreparedAppOpenFresh(1_000, 1_000 + APP_OPEN_AD_MAX_AGE_MS - 1)).toBe(true);
    expect(isPreparedAppOpenFresh(1_000, 1_000 + APP_OPEN_AD_MAX_AGE_MS)).toBe(false);
  });

  it("recovers only valid persisted ad-history fields", () => {
    expect(
      parseAdHistory(
        JSON.stringify({
          version: 1,
          firstUseCompleted: true,
          inactiveAt: -4,
          lastFullScreenShownAt: 500,
        }),
      ),
    ).toEqual({
      version: 1,
      firstUseCompleted: true,
      lastFullScreenShownAt: 500,
    });
    expect(parseAdHistory("not json")).toBeUndefined();
  });

  it("protects editing, payment, authentication, and media surfaces", () => {
    expect(isProtectedAdRoute("/party/one/add", {})).toBe(true);
    expect(isProtectedAdRoute("/party/one", { media: 0 })).toBe(true);
    expect(isProtectedAdRoute("/party/one", { calculator: "amount" })).toBe(true);
    expect(isProtectedAdRoute("/party/one", {})).toBe(false);
  });
});
