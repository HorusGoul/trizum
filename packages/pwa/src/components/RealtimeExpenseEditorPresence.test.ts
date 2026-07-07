import { describe, expect, test } from "vite-plus/test";
import { getPresenceBubblePosition } from "./presencePosition.ts";

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
