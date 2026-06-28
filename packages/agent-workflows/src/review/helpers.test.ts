import { describe, expect, test } from "vite-plus/test";
import {
  classifyCheckStatus,
  inferAffectedAreas,
  isRenovatePullRequest,
  parseDependencyUpdatesFromRenovateBody,
  parseDependencyUpdatesFromDiff,
  pickRenovatePullRequest,
} from "./helpers.js";
import type { RenovatePullRequest } from "../schemas.js";

describe("Renovate review helpers", () => {
  test("detects Renovate pull requests from author, branch, or title", () => {
    expect(
      isRenovatePullRequest({
        authorLogin: "renovate[bot]",
        headRefName: "feature/test",
        title: "Update dependency",
      }),
    ).toBe(true);
    expect(
      isRenovatePullRequest({
        authorLogin: "human",
        headRefName: "renovate/react",
        title: "Update React",
      }),
    ).toBe(true);
    expect(
      isRenovatePullRequest({
        authorLogin: "human",
        headRefName: "feature/test",
        title: "chore(deps): update react",
      }),
    ).toBe(true);
  });

  test("classifies check buckets into a PR-level conclusion", () => {
    expect(
      classifyCheckStatus([
        { bucket: "pass", name: "check" },
        { bucket: "fail", name: "test" },
      ]).conclusion,
    ).toBe("fail");

    expect(
      classifyCheckStatus([
        { bucket: "pass", name: "check" },
        { bucket: "pending", name: "build" },
      ]).conclusion,
    ).toBe("pending");

    expect(classifyCheckStatus([{ bucket: "pass", name: "check" }]).conclusion).toBe("pass");
    expect(classifyCheckStatus([]).conclusion).toBe("unknown");
  });

  test("prefers failing Renovate PRs, then oldest updated PRs", () => {
    const picked = pickRenovatePullRequest([
      makePr(1, "pass", "2026-02-01T00:00:00Z"),
      makePr(2, "fail", "2026-03-01T00:00:00Z"),
      makePr(3, "pending", "2026-01-01T00:00:00Z"),
    ]);

    expect(picked.number).toBe(2);
  });

  test("parses dependency updates from package manifests and catalog diffs", () => {
    const updates =
      parseDependencyUpdatesFromDiff(`diff --git a/packages/pwa/package.json b/packages/pwa/package.json
--- a/packages/pwa/package.json
+++ b/packages/pwa/package.json
@@
-    "react": "18.3.1",
+    "react": "19.0.0",
-    "packageManager": "pnpm@10.0.0",
+    "packageManager": "pnpm@10.1.0",
diff --git a/pnpm-workspace.yaml b/pnpm-workspace.yaml
--- a/pnpm-workspace.yaml
+++ b/pnpm-workspace.yaml
@@
-  vite: 6.0.0
+  vite: 7.0.0
`);

    expect(updates).toEqual([
      {
        file: "packages/pwa/package.json",
        from: "18.3.1",
        name: "react",
        to: "19.0.0",
      },
      {
        file: "pnpm-workspace.yaml",
        from: "6.0.0",
        name: "vite",
        to: "7.0.0",
      },
    ]);
  });

  test("parses dependency updates from Renovate PR body tables", () => {
    const updates = parseDependencyUpdatesFromRenovateBody(`| Package | Type | Update | Change |
|---|---|---|---|
| [ruby](https://www.ruby-lang.org) ([source](https://github.com/ruby/ruby)) | uses-with | minor | \`3.2\` → \`3.4.9\` |
`);

    expect(updates).toEqual([
      {
        file: "renovate-pr-body",
        from: "3.2",
        name: "ruby",
        to: "3.4.9",
      },
    ]);
  });

  test("infers affected areas from files and dependency families", () => {
    expect(
      inferAffectedAreas(
        ["packages/pwa/package.json"],
        [
          {
            file: "packages/pwa/package.json",
            name: "@automerge/automerge",
          },
        ],
      ),
    ).toEqual(["collaboration", "pwa"]);
  });
});

function makePr(
  number: number,
  conclusion: RenovatePullRequest["status"]["conclusion"],
  updatedAt: string,
): RenovatePullRequest {
  return {
    authorLogin: "renovate[bot]",
    baseRefName: "main",
    headRefName: `renovate/test-${number}`,
    isDraft: false,
    labels: [],
    number,
    status: {
      conclusion,
      failing: conclusion === "fail" ? [{ bucket: "fail", name: "test" }] : [],
      passing: conclusion === "pass" ? [{ bucket: "pass", name: "check" }] : [],
      pending: conclusion === "pending" ? [{ bucket: "pending", name: "build" }] : [],
      skipping: [],
      summary: conclusion,
    },
    title: `chore(deps): update ${number}`,
    updatedAt,
    url: `https://github.com/example/repo/pull/${number}`,
  };
}
