import { describe, expect, test } from "vite-plus/test";
import { REVIEW_LABEL } from "./schemas.js";
import { parseCliOptions } from "./cli.js";

describe("agent workflow CLI", () => {
  test("defaults to dry-run Codex review", () => {
    const parsed = parseCliOptions([]);

    expect(parsed.workflowOptions.mode).toBe("dry-run");
    expect(parsed.workflowOptions.codexMode).toBe("auto");
    expect(parsed.workflowOptions.readyForHumanReviewLabel).toBe(REVIEW_LABEL);
  });

  test("supersede implies write mode", () => {
    const parsed = parseCliOptions(["--pr", "123", "--supersede", "--no-codex"]);

    expect(parsed.workflowOptions.prNumber).toBe(123);
    expect(parsed.workflowOptions.mode).toBe("write");
    expect(parsed.workflowOptions.supersede).toBe(true);
    expect(parsed.workflowOptions.codexMode).toBe("off");
  });

  test("supports a custom ready-for-review label and JSON output", () => {
    const parsed = parseCliOptions(["--write", "--label", "ready", "--json"]);

    expect(parsed.json).toBe(true);
    expect(parsed.workflowOptions.mode).toBe("write");
    expect(parsed.workflowOptions.readyForHumanReviewLabel).toBe("ready");
  });
});
