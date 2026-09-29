import { describe, expect, it } from "vite-plus/test";
import { parseAuthReturnTo } from "./authReturnTo.ts";

describe("parseAuthReturnTo", () => {
  it("preserves the redemption code through an authentication callback", () => {
    expect(parseAuthReturnTo("/redeem?code=FRIENDS%26FAMILY#help")).toBe(
      "/redeem?code=FRIENDS%26FAMILY#help",
    );
  });

  it.each([
    undefined,
    null,
    123,
    "https://evil.example",
    "//evil.example",
    "/safe/..//evil.example",
    "/\\evil.example",
    "/\nevil.example",
    "/redeem?code=two words",
  ])("rejects an unsafe return destination: %s", (value) => {
    expect(parseAuthReturnTo(value)).toBeUndefined();
  });
});
