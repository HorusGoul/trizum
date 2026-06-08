import { describe, expect, test } from "vite-plus/test";

import { extractTricountId } from "./tricount.ts";

describe("extractTricountId", () => {
  test("extracts a direct key", () => {
    expect(extractTricountId("tBDnlEsfSMOQDamELo")).toBe("tBDnlEsfSMOQDamELo");
  });

  test("extracts the key from a standard Tricount URL", () => {
    expect(extractTricountId("https://www.tricount.com/tBDnlEsfSMOQDamELo")).toBe(
      "tBDnlEsfSMOQDamELo",
    );
  });

  test("extracts the key from a localized Tricount URL", () => {
    expect(extractTricountId("https://www.tricount.com/de-de/tBDnlEsfSMOQDamELo")).toBe(
      "tBDnlEsfSMOQDamELo",
    );
  });

  test("extracts the key from a localized Tricount URL inside text", () => {
    expect(
      extractTricountId(
        "Join my Tricount: https://www.tricount.com/de-de/tBDnlEsfSMOQDamELo?utm=share.",
      ),
    ).toBe("tBDnlEsfSMOQDamELo");
  });

  test("rejects a Tricount URL without a key", () => {
    expect(extractTricountId("https://www.tricount.com/de-de/")).toBeNull();
  });

  test("rejects unsupported input", () => {
    expect(extractTricountId("not a key")).toBeNull();
  });
});
