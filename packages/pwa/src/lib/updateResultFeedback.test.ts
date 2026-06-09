import { beforeEach, describe, expect, test } from "vite-plus/test";
import { i18n } from "@lingui/core";
import { getUpdateResultFeedbackMessage } from "./updateResultFeedback.ts";

describe("update result feedback", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  test("returns no feedback for started or canceled updates", () => {
    expect(getUpdateResultFeedbackMessage({ status: "started" })).toBeNull();
    expect(getUpdateResultFeedbackMessage({ status: "canceled" })).toBeNull();
  });

  test("returns user feedback for updates that do not start", () => {
    expect(getUpdateResultFeedbackMessage({ status: "failed" })).toBe(
      "Update failed. Please try again.",
    );
    expect(getUpdateResultFeedbackMessage({ status: "not-allowed" })).toBe(
      "Update can't be installed right now.",
    );
    expect(getUpdateResultFeedbackMessage({ status: "unavailable" })).toBe(
      "Update is no longer available.",
    );
  });
});
