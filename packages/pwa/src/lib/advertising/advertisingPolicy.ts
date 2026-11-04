import { z } from "zod";
import type { AppSearch } from "#src/lib/routerSearch.ts";

export const AD_SESSION_GAP_MS = 30 * 60 * 1_000;
export const FULL_SCREEN_AD_COOLDOWN_MS = 30 * 60 * 1_000;
export const APP_OPEN_AD_MAX_AGE_MS = 4 * 60 * 60 * 1_000;

const PROTECTED_AD_ROUTE_SEGMENTS = new Set([
  "add",
  "edit",
  "join",
  "migrate",
  "new",
  "pay",
  "reset-password",
  "redeem",
  "settings",
  "transfer-debt",
  "who",
]);

export interface AdHistory {
  version: 1;
  firstUseCompleted: boolean;
  inactiveAt?: number;
  lastFullScreenShownAt?: number;
}

export function createAdHistory(): AdHistory {
  return {
    version: 1,
    firstUseCompleted: false,
  };
}

export function parseAdHistory(value: string | null): AdHistory | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const result = adHistorySchema.safeParse(JSON.parse(value));

    if (!result.success) return undefined;
    const parsed = result.data;

    const history: AdHistory = {
      version: 1,
      firstUseCompleted: parsed.firstUseCompleted,
    };

    if (isTimestamp(parsed.inactiveAt)) history.inactiveAt = parsed.inactiveAt;

    if (isTimestamp(parsed.lastFullScreenShownAt)) {
      history.lastFullScreenShownAt = parsed.lastFullScreenShownAt;
    }

    return history;
  } catch {
    return undefined;
  }
}

export function resumeAdHistory(history: AdHistory, now: number) {
  const inactiveDuration = history.inactiveAt === undefined ? undefined : now - history.inactiveAt;
  const startedNewSession = inactiveDuration !== undefined && inactiveDuration >= AD_SESSION_GAP_MS;
  const activeHistory = { ...history };
  delete activeHistory.inactiveAt;

  return {
    history: {
      ...activeHistory,
      firstUseCompleted: history.firstUseCompleted || startedNewSession,
    } satisfies AdHistory,
    startedNewSession,
  };
}

export function suspendAdHistory(history: AdHistory, now: number): AdHistory {
  return {
    ...history,
    inactiveAt: now,
  };
}

export function recordFullScreenAdShown(history: AdHistory, now: number): AdHistory {
  return {
    ...history,
    lastFullScreenShownAt: now,
  };
}

export function isFullScreenAdCoolingDown(history: AdHistory, now: number) {
  return (
    history.lastFullScreenShownAt !== undefined &&
    now - history.lastFullScreenShownAt < FULL_SCREEN_AD_COOLDOWN_MS
  );
}

export function isPreparedAppOpenFresh(preparedAt: number | undefined, now: number) {
  return preparedAt !== undefined && now - preparedAt < APP_OPEN_AD_MAX_AGE_MS;
}

export function isProtectedAdRoute(pathname: string, search: AppSearch) {
  if (
    adMediaSearchSchema.safeParse(search).success ||
    adCalculatorSearchSchema.safeParse(search).success
  ) {
    return true;
  }

  return pathname.split("/").some((segment) => PROTECTED_AD_ROUTE_SEGMENTS.has(segment));
}

function isTimestamp(value: unknown): value is number {
  return adTimestampSchema.safeParse(value).success;
}

const adTimestampSchema = z.number().min(0);

const adHistorySchema = z.object({
  version: z.literal(1),
  firstUseCompleted: z.boolean(),
  inactiveAt: adTimestampSchema.optional().catch(undefined),
  lastFullScreenShownAt: adTimestampSchema.optional().catch(undefined),
});

const adMediaSearchSchema = z.object({ media: z.number() });
const adCalculatorSearchSchema = z.object({ calculator: z.string() });
