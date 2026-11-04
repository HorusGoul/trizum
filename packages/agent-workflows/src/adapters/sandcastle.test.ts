/// <reference types="node" />
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import type { PullRequestContext } from "../schemas.js";
import type * as ExecModule from "./exec.js";
import { createSandcastleRunner, type SandcastleExecution } from "./sandcastle.js";

const runReview = vi.fn<SandcastleExecution["runReview"]>();
const runFix = vi.fn<SandcastleExecution["runFix"]>();
const runCommand = vi.fn<typeof ExecModule.runCommand>();

const { runSandcastleCodexFix, runSandcastleCodexReview } = createSandcastleRunner({
  runReview,
  runFix,
  runCommand,
});

const context: PullRequestContext = {
  affectedAreas: [],
  body: "",
  dependencyMetadata: [],
  dependencyUpdates: [],
  diff: "",
  failedCheckLogs: [],
  files: [],
  pr: {
    authorLogin: "renovate[bot]",
    baseRefName: "main",
    headRefName: "renovate/test",
    isDraft: false,
    labels: [],
    number: 407,
    status: {
      conclusion: "fail",
      failing: [],
      passing: [],
      pending: [],
      skipping: [],
      summary: "CI failed.",
    },
    title: "Update dependencies",
    url: "https://github.com/HorusGoul/trizum/pull/407",
  },
  usageMatches: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(runCommand).mockResolvedValue({
    command: "git",
    exitCode: 0,
    stderr: "",
    stdout: "",
  });
});

test.each([
  'Failed to refresh token: 401 Unauthorized: {"code":"invalid_refresh_token"}',
  "Your access token could not be refreshed. Please log out and sign in again.",
  "refresh_token_reused",
  "Could not parse your authentication token. Please try signing in again.",
])("stops the review pipeline on an authentication failure: %s", async (message) => {
  runReview.mockRejectedValue(new Error(message));

  await expect(runSandcastleCodexReview(context, "/repo")).rejects.toThrow(
    "CI login needs renewal",
  );
  expect(runReview).toHaveBeenCalledTimes(1);
  expect(runCommand).toHaveBeenCalledWith("git", ["branch", "-D", expect.any(String)], {
    allowFailure: true,
    cwd: "/repo",
  });
});

test("keeps ordinary review failures available for the existing repair flow", async () => {
  runReview.mockRejectedValue(new Error("GitHub returned 401 Unauthorized"));
  await expect(runSandcastleCodexReview(context, "/repo")).resolves.toMatchObject({
    ran: false,
    error: "GitHub returned 401 Unauthorized",
  });
});

test("reports authentication failure during a repair without exposing the raw error", async () => {
  runFix.mockRejectedValue(
    new Error('invalid_refresh_token {"refresh_token":"sensitive-test-value"}'),
  );
  await expect(runSandcastleCodexFix(context, "/repo", "agent/fix")).rejects.toThrow(
    /^CI login needs renewal\./,
  );
});

test.each(["review", "repair"])(
  "stops a real Sandcastle %s when the auth error is only on stdout",
  async (mode) => {
    const realRunner = createSandcastleRunner();
    const directory = await mkdtemp(path.join(tmpdir(), "trizum-codex-boundary-"));

    try {
      execFileSync("git", ["init", "-b", "main", directory], { stdio: "ignore" });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          "-c",
          "core.hooksPath=/dev/null",
          "commit",
          "--allow-empty",
          "-m",
          "fixture",
        ],
        { cwd: directory, stdio: "ignore" },
      );
      await writeFile(
        path.join(directory, "codex"),
        `#!/usr/bin/env node
require('node:fs').readFileSync(0);
process.stderr.write('Reading prompt from stdin...\\n');
process.stdout.write(JSON.stringify({type: 'turn.failed', error: {
  message: 'Your access token could not be refreshed. Please log out and sign in again.'
}}) + '\\n');
process.exitCode = 1;
`,
        { mode: 0o700 },
      );
      await writeFile(path.join(directory, "vp"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
      vi.stubEnv("PATH", `${directory}:${process.env.PATH}`);

      const result =
        mode === "review"
          ? realRunner.runSandcastleCodexReview(context, directory)
          : realRunner.runSandcastleCodexFix(context, directory, "agent/fix");

      await expect(result).rejects.toThrow("CI login needs renewal");
    } finally {
      vi.unstubAllEnvs();
      await rm(directory, { force: true, recursive: true });
    }
  },
  15_000,
);
