import { describe, expect, test } from "vite-plus/test";
import { getPresenceBubblePosition, getPresenceElementIdFromTarget } from "./presencePosition.ts";

function createElement({
  dataset,
  left,
  right,
  top,
}: {
  dataset?: Partial<DOMStringMap>;
  left: number;
  right: number;
  top: number;
}) {
  return {
    dataset,
    getBoundingClientRect: () =>
      ({
        left,
        right,
        top,
      }) as DOMRectReadOnly,
  } as HTMLElement;
}

function createPresenceTarget({
  dataset,
  parentElement = null,
}: {
  dataset?: Partial<DOMStringMap>;
  parentElement?: HTMLElement | null;
}) {
  return {
    dataset,
    parentElement,
  } as HTMLElement;
}

describe("getPresenceBubblePosition", () => {
  test("positions the bubble relative to the overlay instead of the element offset parent", () => {
    const overlay = createElement({ left: 40, right: 440, top: 100 });
    const amountField = createElement({
      dataset: {
        presenceOffsetLeft: "-10",
        presenceOffsetTop: "6",
      },
      left: 72,
      right: 360,
      top: 260,
    });

    expect(getPresenceBubblePosition(amountField, overlay)).toEqual({
      left: 310,
      top: 166,
    });
  });
});

describe("getPresenceElementIdFromTarget", () => {
  test("uses a proxy presence id when a portaled control represents another anchor", () => {
    const toolbar = createPresenceTarget({
      dataset: { presenceProxyElementId: "participant-alice" },
    });
    const button = createPresenceTarget({ parentElement: toolbar });

    expect(getPresenceElementIdFromTarget(button)).toBe("participant-alice");
  });

  test("walks from icon targets to a parent proxy presence id", () => {
    const toolbar = createPresenceTarget({
      dataset: { presenceProxyElementId: "participant-alice" },
    });
    const button = createPresenceTarget({ parentElement: toolbar });
    const icon = { parentElement: button } as Element;

    expect(getPresenceElementIdFromTarget(icon)).toBe("participant-alice");
  });

  test("finds the nearest parent presence id when the target has none", () => {
    const row = createPresenceTarget({
      dataset: { presenceElementId: "participant-alice" },
    });
    const input = createPresenceTarget({ parentElement: row });

    expect(getPresenceElementIdFromTarget(input)).toBe("participant-alice");
  });
});
