import { describe, expect, test } from "vite-plus/test";
import { calculateMediaGalleryPinchTransform } from "./mediaGalleryPinch.ts";

describe("calculateMediaGalleryPinchTransform", () => {
  test("scales around a stationary pinch origin", () => {
    expect(
      calculateMediaGalleryPinchTransform({
        currentPosition: [0, 0],
        currentScale: 1,
        previousOrigin: [100, -50],
        nextOrigin: [100, -50],
        nextScale: 2,
      }),
    ).toEqual({ x: -100, y: 50, scale: 2 });
  });

  test("follows a moving pinch midpoint while scaling", () => {
    expect(
      calculateMediaGalleryPinchTransform({
        currentPosition: [0, 0],
        currentScale: 1,
        previousOrigin: [0, 0],
        nextOrigin: [50, 30],
        nextScale: 2,
      }),
    ).toEqual({ x: 50, y: 30, scale: 2 });
  });

  test("tracks midpoint movement one-to-one when scale is unchanged", () => {
    expect(
      calculateMediaGalleryPinchTransform({
        currentPosition: [10, -5],
        currentScale: 2,
        previousOrigin: [20, 15],
        nextOrigin: [45, 5],
        nextScale: 2,
      }),
    ).toEqual({ x: 35, y: -15, scale: 2 });
  });
});
