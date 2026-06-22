import { i18n } from "@lingui/core";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { getAuthCallbackErrorContent } from "./authCallbackErrors.ts";

describe("getAuthCallbackErrorContent", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  test("maps email mismatch callback errors", () => {
    expect(getAuthCallbackErrorContent("email_doesn't_match")).toEqual({
      title: "Email addresses don't match",
      description:
        "To connect Google or Apple, choose an account with the same email address as your trizum cloud account.",
    });

    expect(getAuthCallbackErrorContent("email_doesn%27t_match").title).toBe(
      "Email addresses don't match",
    );
  });

  test("maps invalid token callback errors", () => {
    expect(getAuthCallbackErrorContent("INVALID_TOKEN")).toEqual({
      title: "Sign-in link expired",
      description: "This sign-in link is invalid or expired. Request a new link and try again.",
    });
  });

  test("maps unknown callback errors to a generic message", () => {
    expect(getAuthCallbackErrorContent("provider_error")).toEqual({
      title: "Couldn't connect sign-in method",
      description: "trizum could not finish connecting that sign-in method. Please try again.",
    });
  });
});
