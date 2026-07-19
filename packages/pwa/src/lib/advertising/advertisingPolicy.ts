export const AD_SESSION_GAP_MS = 30 * 60 * 1_000;
export const FULL_SCREEN_AD_COOLDOWN_MS = 30 * 60 * 1_000;
export const APP_OPEN_AD_MAX_AGE_MS = 4 * 60 * 60 * 1_000;

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
    const parsed = JSON.parse(value) as Partial<AdHistory>;
    if (parsed.version !== 1 || typeof parsed.firstUseCompleted !== "boolean") {
      return undefined;
    }

    return {
      version: 1,
      firstUseCompleted: parsed.firstUseCompleted,
      ...(isTimestamp(parsed.inactiveAt) ? { inactiveAt: parsed.inactiveAt } : {}),
      ...(isTimestamp(parsed.lastFullScreenShownAt)
        ? { lastFullScreenShownAt: parsed.lastFullScreenShownAt }
        : {}),
    };
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

export function isProtectedAdRoute(pathname: string, search: Record<string, unknown>) {
  if (typeof search.media === "number" || typeof search.calculator === "string") {
    return true;
  }

  return [
    "/add",
    "/edit",
    "/pay",
    "/transfer-debt",
    "/migrate",
    "/join",
    "/reset-password",
    "/settings/cloud-sync",
  ].some((segment) => pathname.includes(segment));
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
