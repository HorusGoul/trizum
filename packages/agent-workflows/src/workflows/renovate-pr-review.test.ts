import { describe, expect, test } from "vite-plus/test";
import type { PullRequestContext } from "../schemas.js";
import {
  canUpdateOriginalRenovatePr,
  renderSupersedingPullRequestBody,
  type LocalValidationResult,
} from "./renovate-pr-review.js";

describe("Renovate PR review workflow", () => {
  test("allows updating the original PR for lockfile and workspace metadata fixes", () => {
    expect(canUpdateOriginalRenovatePr(["pnpm-lock.yaml"])).toBe(true);
    expect(canUpdateOriginalRenovatePr(["pnpm-workspace.yaml"])).toBe(true);
    expect(canUpdateOriginalRenovatePr(["pnpm-lock.yaml", "pnpm-workspace.yaml"])).toBe(true);
  });

  test("requires a superseding PR for empty or broader fixes", () => {
    expect(canUpdateOriginalRenovatePr([])).toBe(false);
    expect(canUpdateOriginalRenovatePr(["packages/pwa/package.json"])).toBe(false);
    expect(canUpdateOriginalRenovatePr(["pnpm-lock.yaml", "packages/pwa/package.json"])).toBe(
      false,
    );
  });

  test("explains why superseding PRs exist and reports the failed local command", () => {
    const context = {
      affectedAreas: ["mobile", "workspace"],
      body: "",
      dependencyMetadata: [],
      dependencyUpdates: [
        { file: "pnpm-workspace.yaml", from: "8.0.1", name: "@capacitor/android", to: "8.4.1" },
        { file: "pnpm-workspace.yaml", from: "8.0.0", name: "@capacitor/app", to: "8.1.0" },
        { file: "pnpm-workspace.yaml", from: "8.0.1", name: "@capacitor/cli", to: "8.4.1" },
        { file: "pnpm-workspace.yaml", from: "8.0.1", name: "@capacitor/core", to: "8.4.1" },
        { file: "pnpm-workspace.yaml", from: "8.0.1", name: "@capacitor/ios", to: "8.4.1" },
      ],
      diff: "",
      failedCheckLogs: [],
      files: ["pnpm-lock.yaml", "pnpm-workspace.yaml"],
      pr: {
        authorLogin: "renovate[bot]",
        baseRefName: "main",
        headRefName: "renovate/capacitor",
        isDraft: false,
        labels: [],
        number: 262,
        status: {
          conclusion: "pass",
          failing: [],
          passing: [],
          pending: [],
          skipping: [],
          summary: "All checks passed.",
        },
        title: "chore(deps): update capacitor dependencies",
        url: "https://github.com/HorusGoul/trizum/pull/262",
      },
      usageMatches: [],
    } satisfies PullRequestContext;
    const report = [
      "### Summary",
      "The catalog and lockfile update is coherent, but tracked Capacitor native files still reference removed pnpm package paths.",
      "",
      "### Findings",
      "- [blocker] iOS Podfile and Podfile.lock still pin old Capacitor package paths: Refresh iOS with cap sync ios and pod install, then commit Podfile plus Podfile.lock.",
    ].join("\n");
    const localValidation = {
      commands: [
        { command: "vp install --frozen-lockfile --ignore-scripts --prefer-offline", exitCode: 0 },
        { command: "vp run check", exitCode: 0 },
        { command: "vp run test", exitCode: 0 },
        { command: "vp run build", exitCode: 1 },
      ],
      failedCommand: "vp run build",
      failedExitCode: 1,
      failureSummary:
        "Could not find 'bundler' (2.7.2) required by packages/mobile/ios/App/Gemfile.lock.",
      output: "",
      passed: false,
    } satisfies LocalValidationResult;
    const body = renderSupersedingPullRequestBody(
      context,
      report,
      "Completed and committed `49b8ab2 chore(deps): complete Renovate PR #262`.",
      localValidation,
      [
        "packages/mobile/android/capacitor.settings.gradle",
        "packages/mobile/ios/App/Podfile",
        "packages/mobile/ios/App/Podfile.lock",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
      ],
    );

    expect(body).toContain("## Why This PR Exists");
    expect(body).toContain(
      "tracked Capacitor native files still reference removed pnpm package paths",
    );
    expect(body).toContain("iOS Podfile and Podfile.lock still pin old Capacitor package paths");
    expect(body).toContain("## What Changed");
    expect(body).toContain("- Dependency update: @capacitor/android 8.0.1 -> 8.4.1");
    expect(body).toContain("and 1 more");
    expect(body).toContain("- Agent fix: Applied the agent-generated fix");
    expect(body).toContain("`packages/mobile/ios/App/Podfile.lock`");
    expect(body).toContain("- [fail] `vp run build` (exit 1)");
    expect(body).toContain("- Failed command: `vp run build` (exit 1).");
    expect(body).toContain("Could not find 'bundler' (2.7.2)");
  });
});
