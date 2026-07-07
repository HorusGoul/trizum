import { describe, expect, test } from "vite-plus/test";
import {
  arePresenceBubblePositionsEqual,
  getPresenceBubblePosition,
  getPresenceElementIdFromTarget,
} from "./presencePosition.ts";

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

  test("reflects anchor position changes without relying on element size changes", () => {
    const overlay = createElement({ left: 40, right: 440, top: 100 });
    let anchorTop = 260;
    let anchorRight = 360;
    const amountField = {
      dataset: {
        presenceOffsetLeft: "-10",
        presenceOffsetTop: "6",
      },
      getBoundingClientRect: () =>
        ({
          right: anchorRight,
          top: anchorTop,
        }) as DOMRectReadOnly,
    } as unknown as HTMLElement;

    expect(getPresenceBubblePosition(amountField, overlay)).toEqual({
      left: 310,
      top: 166,
    });

    anchorTop = 300;
    anchorRight = 380;

    expect(getPresenceBubblePosition(amountField, overlay)).toEqual({
      left: 330,
      top: 206,
    });
  });
});

describe("arePresenceBubblePositionsEqual", () => {
  test("detects unchanged and changed bubble positions", () => {
    expect(arePresenceBubblePositionsEqual({ left: 10, top: 20 }, { left: 10, top: 20 })).toBe(
      true,
    );
    expect(arePresenceBubblePositionsEqual({ left: 10, top: 20 }, { left: 10, top: 21 })).toBe(
      false,
    );
    expect(arePresenceBubblePositionsEqual(null, { left: 10, top: 20 })).toBe(false);
  });
});

describe("getPresenceElementIdFromTarget", () => {
  test("uses a proxy presence id directly on a calculator opener", () => {
    const button = createPresenceTarget({
      dataset: { presenceProxyElementId: "amount" },
    });

    expect(getPresenceElementIdFromTarget(button)).toBe("amount");
  });

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
