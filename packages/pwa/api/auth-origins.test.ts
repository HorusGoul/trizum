import { describe, expect, test } from "vite-plus/test";
import { isTrustedOrigin } from "./auth-origins";

describe("auth origin trust", () => {
  test("trusts production and horusdev Worker origins", () => {
    expect(isTrustedOrigin("https://trizum.app", {})).toBe(true);
    expect(isTrustedOrigin("https://trizum.horusdev.workers.dev", {})).toBe(true);
    expect(isTrustedOrigin("https://pr-190-trizum.horusdev.workers.dev", {})).toBe(true);
    expect(isTrustedOrigin("https://another-worker.horusdev.workers.dev", {})).toBe(true);
  });

  test("rejects provider-wide preview origins", () => {
    expect(isTrustedOrigin("https://example.workers.dev", {})).toBe(false);
    expect(isTrustedOrigin("https://pr-190-example.workers.dev", {})).toBe(false);
    expect(isTrustedOrigin("https://trizum.pages.dev", {})).toBe(false);
    expect(isTrustedOrigin("https://pr-190-trizum.pages.dev", {})).toBe(false);
  });

  test("keeps local app origins available for development", () => {
    expect(isTrustedOrigin("http://localhost", {})).toBe(true);
    expect(isTrustedOrigin("http://localhost:5173", {})).toBe(true);
    expect(isTrustedOrigin("http://localhost:8787", {})).toBe(true);
    expect(isTrustedOrigin("ionic://localhost", {})).toBe(true);
    expect(isTrustedOrigin("capacitor://localhost", {})).toBe(true);
  });
});
