import { beforeEach, expect, test, vi } from "vite-plus/test";
import { run } from "@ai-hero/sandcastle";
import type * as SandcastleModule from "@ai-hero/sandcastle";
import type { PullRequestContext } from "../schemas.js";
import { runCommand } from "./exec.js";
import type * as ExecModule from "./exec.js";
import { runSandcastleCodexFix, runSandcastleCodexReview } from "./sandcastle.js";

vi.mock("@ai-hero/sandcastle", async (importOriginal) => ({
  ...(await importOriginal<typeof SandcastleModule>()),
  run: vi.fn<typeof run>(),
}));
vi.mock("./exec.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ExecModule>()),
  runCommand: vi.fn<typeof runCommand>(),
}));

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
  vi.mocked(run).mockRejectedValue(new Error(message));

  await expect(runSandcastleCodexReview(context, "/repo")).rejects.toThrow(
    "CI login needs renewal",
  );
  expect(run).toHaveBeenCalledTimes(1);
  expect(runCommand).toHaveBeenCalledWith("git", ["branch", "-D", expect.any(String)], {
    allowFailure: true,
    cwd: "/repo",
  });
});

test("keeps ordinary review failures available for the existing repair flow", async () => {
  vi.mocked(run).mockRejectedValue(new Error("GitHub returned 401 Unauthorized"));
  await expect(runSandcastleCodexReview(context, "/repo")).resolves.toMatchObject({
    ran: false,
    error: "GitHub returned 401 Unauthorized",
  });
});

test("reports authentication failure during a repair without exposing the raw error", async () => {
  vi.mocked(run).mockRejectedValue(
    new Error('invalid_refresh_token {"refresh_token":"sensitive-test-value"}'),
  );
  await expect(runSandcastleCodexFix(context, "/repo", "agent/fix")).rejects.toThrow(
    /^CI login needs renewal\./,
  );
});
