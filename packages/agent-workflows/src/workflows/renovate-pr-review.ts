import { chmod, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runPipeline } from "@barnum/barnum/pipeline";
import { createHandler } from "@barnum/barnum/runtime";
import {
  checkRunSchema,
  codexReviewResultSchema,
  contextStateSchema,
  listedPullRequestsStateSchema,
  reviewBundleSchema,
  reviewDecisionSchema,
  reviewResultSchema,
  selectedPullRequestStateSchema,
  workflowOptionsSchema,
  workflowResultSchema,
  type CheckRun,
  type CodexReviewResult,
  type DependencyMetadata,
  type FailedCheckLog,
  type PullRequestContext,
  type ReviewBundle,
  type ReviewDecision,
  type ReviewFinding,
  type ReviewResult,
  type SupersedingPullRequest,
  type WorkflowOptions,
  type WorkflowResult,
} from "../schemas.js";
import {
  createSanitizedEnvironment,
  redactSecrets,
  runCommand,
  splitLines,
  truncateText,
} from "../adapters/exec.js";
import {
  runSandcastleCodexFix,
  runSandcastleCodexReview,
  type SandcastleFixRun,
} from "../adapters/sandcastle.js";
import {
  buildDeterministicReview,
  classifyCheckStatus,
  dedupeStrings,
  hasBlockingFindings,
  inferAffectedAreas,
  isRenovatePullRequest,
  mergeReviewResults,
  mergeDependencyUpdates,
  normalizeGhPullRequest,
  parseDependencyUpdatesFromDiff,
  parseDependencyUpdatesFromRenovateBody,
  parseRgUsage,
  pickRenovatePullRequest,
  type RawGhPullRequest,
} from "../review/helpers.js";

const MAX_DIFF_BYTES = 180_000;
const MAX_LOG_BYTES = 40_000;
const MAX_USAGE_MATCHES = 200;
const MAX_DEPENDENCY_METADATA = 12;

interface LocalValidationResult {
  output: string;
  passed: boolean;
}

export const listRenovatePullRequests = createHandler(
  {
    inputValidator: workflowOptionsSchema,
    outputValidator: listedPullRequestsStateSchema,
    handle: async ({ value: options }) => {
      const raw = await ghJson<RawGhPullRequest[]>(
        options,
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "100",
        "--json",
        [
          "author",
          "baseRefName",
          "createdAt",
          "headRefName",
          "isDraft",
          "labels",
          "number",
          "title",
          "updatedAt",
          "url",
        ].join(","),
      );

      const candidates = (
        await Promise.all(
          raw.map(async (candidate) => {
            const status = await readPrCheckStatus(options, candidate.number);
            return normalizeGhPullRequest(candidate, status);
          }),
        )
      ).filter(isRenovatePullRequest);

      return {
        candidates,
        options,
      };
    },
  },
  "listRenovatePullRequests",
);

export const selectRenovatePullRequest = createHandler(
  {
    inputValidator: listedPullRequestsStateSchema,
    outputValidator: selectedPullRequestStateSchema,
    handle: async ({ value }) => ({
      options: value.options,
      pr: pickRenovatePullRequest(value.candidates, value.options.prNumber),
    }),
  },
  "selectRenovatePullRequest",
);

export const gatherPullRequestContext = createHandler(
  {
    inputValidator: selectedPullRequestStateSchema,
    outputValidator: contextStateSchema,
    handle: async ({ value }) => {
      const [view, diffResult, nameResult] = await Promise.all([
        ghJson<{ body?: string }>(
          value.options,
          "pr",
          "view",
          String(value.pr.number),
          "--json",
          "body",
        ),
        gh(value.options, ["pr", "diff", String(value.pr.number), "--patch"]),
        gh(value.options, ["pr", "diff", String(value.pr.number), "--name-only"]),
      ]);

      const diff = truncateText(redactSecrets(diffResult.stdout), MAX_DIFF_BYTES);
      const files = splitLines(nameResult.stdout);
      const body = redactSecrets(view.body ?? "");
      const dependencyUpdates = mergeDependencyUpdates([
        ...parseDependencyUpdatesFromDiff(diff),
        ...parseDependencyUpdatesFromRenovateBody(body),
      ]);
      const affectedAreas = inferAffectedAreas(files, dependencyUpdates);
      const [usageMatches, dependencyMetadata, failedCheckLogs] = await Promise.all([
        gatherUsageMatches(value.options, dependencyUpdates),
        gatherDependencyMetadata(value.options.repoRoot, dependencyUpdates),
        gatherFailedCheckLogs(value.options, value.pr.status.failing),
      ]);

      return {
        context: {
          affectedAreas,
          body,
          dependencyMetadata,
          dependencyUpdates,
          diff,
          failedCheckLogs,
          files,
          pr: value.pr,
          usageMatches,
        },
        options: value.options,
      };
    },
  },
  "gatherPullRequestContext",
);

export const deterministicReviewPullRequest = createHandler(
  {
    inputValidator: contextStateSchema,
    outputValidator: contextStateSchema.extend({
      deterministic: reviewResultSchema,
    }),
    handle: async ({ value }) => ({
      ...value,
      deterministic: buildDeterministicReview(value.context),
    }),
  },
  "deterministicReviewPullRequest",
);

export const codexReviewPullRequest = createHandler(
  {
    inputValidator: contextStateSchema.extend({
      deterministic: reviewResultSchema,
    }),
    outputValidator: contextStateSchema.extend({
      codex: codexReviewResultSchema,
      deterministic: reviewResultSchema,
    }),
    handle: async ({ value }) => {
      const codex = await maybeRunCodexReview(value.context, value.options);
      return {
        ...value,
        codex,
      };
    },
  },
  "codexReviewPullRequest",
);

export const combineReviewBundle = createHandler(
  {
    inputValidator: contextStateSchema.extend({
      codex: codexReviewResultSchema,
      deterministic: reviewResultSchema,
    }),
    outputValidator: reviewBundleSchema,
    handle: async ({ value }) => ({
      codex: value.codex,
      context: value.context,
      deterministic: value.deterministic,
    }),
  },
  "combineReviewBundle",
);

export const decideReviewOutcome = createHandler(
  {
    inputValidator: reviewBundleSchema,
    outputValidator: reviewDecisionSchema,
    handle: async ({ value }) => decideReview(value),
  },
  "decideReviewOutcome",
);

export const actOnReviewDecision = createHandler(
  {
    inputValidator: reviewDecisionSchema,
    outputValidator: workflowResultSchema,
    handle: async ({ value }) => actOnDecision(value),
  },
  "actOnReviewDecision",
);

export function createRenovatePrReviewPipeline() {
  return listRenovatePullRequests
    .then(selectRenovatePullRequest)
    .then(gatherPullRequestContext)
    .then(deterministicReviewPullRequest)
    .then(codexReviewPullRequest)
    .then(combineReviewBundle)
    .then(decideReviewOutcome)
    .then(actOnReviewDecision);
}

export async function runRenovatePrReviewWorkflow(
  options: WorkflowOptions,
): Promise<WorkflowResult> {
  const previousOptions = process.env.TRIZUM_AGENT_WORKFLOWS_OPTIONS_JSON;
  process.env.TRIZUM_AGENT_WORKFLOWS_OPTIONS_JSON = JSON.stringify(options);
  try {
    return await runPipeline(createRenovatePrReviewPipeline(), options);
  } finally {
    if (previousOptions == null) {
      delete process.env.TRIZUM_AGENT_WORKFLOWS_OPTIONS_JSON;
    } else {
      process.env.TRIZUM_AGENT_WORKFLOWS_OPTIONS_JSON = previousOptions;
    }
  }
}

async function maybeRunCodexReview(
  context: PullRequestContext,
  options: WorkflowOptions,
): Promise<CodexReviewResult> {
  if (options.codexMode === "off") {
    return {
      affectedAreas: [],
      automatedTestSuggestions: [],
      changelogNotes: [],
      findings: [],
      manualTestPlan: [],
      ran: false,
      summary: "Codex review disabled.",
    };
  }

  const result = await runSandcastleCodexReview(context, options.repoRoot);
  if (result.ran || options.codexMode !== "required") {
    return result;
  }

  return {
    ...result,
    findings: [
      {
        details: result.error ?? "Codex was required but did not return a review.",
        severity: "blocker",
        title: "Required Codex review failed",
      },
    ],
  };
}

function decideReview(bundle: ReviewBundle): ReviewDecision {
  const combined = mergeReviewResults(bundle.deterministic, bundle.codex);
  const blockingFindings = combined.findings.filter((finding) => finding.severity === "blocker");
  const foundIssues = hasBlockingFindings(combined);
  const checkConclusion = bundle.context.pr.status.conclusion;

  if (checkConclusion === "fail" && bundle.context.pr.isDraft === false) {
    return {
      action: "supersede-original",
      blockingFindings,
      foundIssues: true,
      review: bundle,
      summary:
        "The Renovate PR has failing checks and should be superseded if write mode is enabled.",
    };
  }

  if (checkConclusion === "pending") {
    return {
      action: "wait-for-checks",
      blockingFindings,
      foundIssues,
      review: bundle,
      summary: "The Renovate PR still has pending checks.",
    };
  }

  if (checkConclusion === "unknown") {
    return {
      action: "needs-human",
      blockingFindings,
      foundIssues: true,
      review: bundle,
      summary: "The Renovate PR check status could not be verified.",
    };
  }

  if (foundIssues) {
    return {
      action: bundle.context.pr.isDraft ? "needs-human" : "supersede-original",
      blockingFindings,
      foundIssues,
      review: bundle,
      summary: bundle.context.pr.isDraft
        ? "The review found blocking issues that need attention."
        : "The review found blocking issues and should be superseded if write mode is enabled.",
    };
  }

  return {
    action: "label-original",
    blockingFindings,
    foundIssues: false,
    review: bundle,
    summary: "The review found no blocking issues.",
  };
}

async function actOnDecision(decision: ReviewDecision): Promise<WorkflowResult> {
  const context = decision.review.context;
  const options = getWorkflowOptionsFromEnv();
  const dryRun = options.mode === "dry-run";
  const report = renderReviewReport(decision);
  const comment = renderReviewComment(decision);

  if (dryRun || decision.action === "dry-run") {
    return {
      decision,
      dryRun: true,
      originalPr: context.pr,
      report,
    };
  }

  if (decision.action === "label-original") {
    await ensureReadyLabel(options);
    await addLabelToIssue(options, context.pr.number, options.readyForHumanReviewLabel);
    if (options.postReviewComment) {
      await commentOnPullRequest(options, context.pr.number, comment);
    }
    return {
      decision,
      dryRun: false,
      labelAppliedTo: context.pr.number,
      originalPr: context.pr,
      report,
    };
  }

  if (decision.action === "supersede-original" && options.supersede) {
    const supersedingPullRequest = await createSupersedingPullRequest(options, context, report);
    return {
      decision,
      dryRun: false,
      originalPr: context.pr,
      report,
      supersedingPullRequest,
    };
  }

  if (options.postReviewComment) {
    await commentOnPullRequest(options, context.pr.number, comment);
  }

  return {
    decision,
    dryRun: false,
    originalPr: context.pr,
    report,
  };
}

function getWorkflowOptionsFromEnv(): WorkflowOptions {
  const raw = process.env.TRIZUM_AGENT_WORKFLOWS_OPTIONS_JSON;
  if (raw == null) {
    throw new Error("Missing TRIZUM_AGENT_WORKFLOWS_OPTIONS_JSON.");
  }

  return workflowOptionsSchema.parse(JSON.parse(raw));
}

async function ghJson<T>(options: WorkflowOptions, ...args: string[]): Promise<T> {
  const result = await gh(options, args);
  return JSON.parse(result.stdout) as T;
}

async function gh(
  options: WorkflowOptions,
  args: readonly string[],
  commandOptions: { allowFailure?: boolean; cwd?: string; input?: string } = {},
) {
  return runCommand("gh", withRepoArgsForCommand(options, args), {
    allowFailure: commandOptions.allowFailure,
    cwd: commandOptions.cwd ?? options.repoRoot,
    input: commandOptions.input,
  });
}

function withRepoArgsForCommand(options: WorkflowOptions, args: readonly string[]): string[] {
  if (args[0] === "api") {
    return [...args];
  }

  return options.repository == null ? [...args] : [...args, "--repo", options.repository];
}

function repositoryApiPath(options: WorkflowOptions, path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  if (options.repository == null) {
    return `repos/:owner/:repo/${normalizedPath}`;
  }

  const [owner, repo, ...extra] = options.repository.split("/");
  if (!owner || !repo || extra.length > 0) {
    throw new Error(`Expected repository in owner/name format, received: ${options.repository}`);
  }

  return `repos/${owner}/${repo}/${normalizedPath}`;
}

async function readPrCheckStatus(options: WorkflowOptions, prNumber?: number) {
  if (prNumber == null) {
    return classifyCheckStatus([]);
  }

  const result = await gh(
    options,
    [
      "pr",
      "checks",
      String(prNumber),
      "--json",
      "bucket,completedAt,description,event,link,name,startedAt,state,workflow",
    ],
    { allowFailure: true },
  );

  const parsed = result.stdout.trim() ? JSON.parse(result.stdout) : [];
  const checks = checkRunSchema.array().parse(parsed);
  return classifyCheckStatus(checks);
}

async function gatherUsageMatches(options: WorkflowOptions, updates: readonly { name: string }[]) {
  const matches = [];
  for (const name of dedupeStrings(updates.map((update) => update.name)).slice(
    0,
    MAX_DEPENDENCY_METADATA,
  )) {
    if (!isSearchablePackageName(name)) {
      continue;
    }

    const result = await runCommand(
      "rg",
      [
        "--fixed-strings",
        "--line-number",
        "--glob",
        "!pnpm-lock.yaml",
        "--glob",
        "!**/node_modules/**",
        "--glob",
        "!**/dist/**",
        "--",
        name,
      ],
      {
        allowFailure: true,
        cwd: options.repoRoot,
      },
    );
    matches.push(...parseRgUsage(result.stdout));
  }

  return matches.slice(0, MAX_USAGE_MATCHES);
}

async function gatherDependencyMetadata(
  repoRoot: string,
  updates: readonly { name: string }[],
): Promise<DependencyMetadata[]> {
  const packageNames = dedupeStrings(updates.map((update) => update.name))
    .filter(isNpmPackageName)
    .slice(0, MAX_DEPENDENCY_METADATA);

  const metadata = await Promise.all(
    packageNames.map(async (name) => {
      const result = await runCommand(
        "npm",
        ["view", name, "name", "version", "homepage", "repository.url", "bugs.url", "--json"],
        {
          allowFailure: true,
          cwd: repoRoot,
        },
      );

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return {
          name,
        };
      }

      const raw = JSON.parse(result.stdout) as Record<string, unknown>;
      const repositoryUrl = stringFromUnknown(raw["repository.url"]);
      const bugsUrl = stringFromUnknown(raw["bugs.url"]);
      return {
        changelogUrl: inferChangelogUrl(repositoryUrl, bugsUrl),
        homepage: stringFromUnknown(raw.homepage),
        name,
        registryVersion: stringFromUnknown(raw.version),
        repositoryUrl,
      };
    }),
  );

  return metadata;
}

async function gatherFailedCheckLogs(
  options: WorkflowOptions,
  failingChecks: readonly CheckRun[],
): Promise<FailedCheckLog[]> {
  const logs: FailedCheckLog[] = [];

  for (const check of failingChecks.slice(0, 3)) {
    const runId = extractGitHubActionsRunId(check.link);
    if (runId == null) {
      logs.push({
        checkName: check.name,
        log: check.description ?? "No GitHub Actions run ID found for this failing check.",
      });
      continue;
    }

    const result = await gh(options, ["run", "view", runId, "--log-failed"], {
      allowFailure: true,
    });
    logs.push({
      checkName: check.name,
      log: truncateText(redactSecrets(result.stdout || result.stderr), MAX_LOG_BYTES),
      runId,
    });
  }

  return logs;
}

function extractGitHubActionsRunId(link: string | undefined): string | undefined {
  return /\/actions\/runs\/(?<runId>\d+)/.exec(link ?? "")?.groups?.runId;
}

function isSearchablePackageName(name: string): boolean {
  return name !== "name" && name !== "version" && name !== "packageManager" && name.length > 1;
}

function isNpmPackageName(name: string): boolean {
  return (
    isSearchablePackageName(name) && (/^(@[\w.-]+\/)?[\w.-]+$/.test(name) || name.startsWith("@"))
  );
}

function inferChangelogUrl(
  repositoryUrl: string | undefined,
  bugsUrl: string | undefined,
): string | undefined {
  const url = repositoryUrl ?? bugsUrl;
  if (url == null) {
    return undefined;
  }

  const normalized = url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:/, "https:");

  if (normalized.includes("github.com")) {
    return `${normalized}/releases`;
  }

  return normalized;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function ensureReadyLabel(options: WorkflowOptions): Promise<void> {
  const body = JSON.stringify({
    color: "0E8A16",
    description: "Ready for a human reviewer after agent workflow review.",
    name: options.readyForHumanReviewLabel,
  });
  const createResult = await gh(
    options,
    ["api", "--method", "POST", repositoryApiPath(options, "labels"), "--input", "-"],
    {
      allowFailure: true,
      input: body,
    },
  );

  if (createResult.exitCode === 0) {
    return;
  }

  await gh(
    options,
    [
      "api",
      "--method",
      "PATCH",
      repositoryApiPath(options, `labels/${encodeURIComponent(options.readyForHumanReviewLabel)}`),
      "--input",
      "-",
    ],
    {
      input: body,
    },
  );
}

async function addLabelToIssue(
  options: WorkflowOptions,
  issueNumber: number,
  label: string,
): Promise<void> {
  await gh(
    options,
    [
      "api",
      "--method",
      "POST",
      repositoryApiPath(options, `issues/${issueNumber}/labels`),
      "--input",
      "-",
    ],
    {
      input: JSON.stringify({
        labels: [label],
      }),
    },
  );
}

async function commentOnPullRequest(
  options: WorkflowOptions,
  prNumber: number,
  body: string,
): Promise<void> {
  await gh(
    options,
    [
      "api",
      "--method",
      "POST",
      repositoryApiPath(options, `issues/${prNumber}/comments`),
      "--input",
      "-",
    ],
    {
      input: JSON.stringify({
        body,
      }),
    },
  );
}

async function createSupersedingPullRequest(
  options: WorkflowOptions,
  context: PullRequestContext,
  report: string,
): Promise<SupersedingPullRequest> {
  await ensureReadyLabel(options);

  const branchName = `agent/renovate-pr-${context.pr.number}-${Date.now()}`;
  let worktreeRoot: string | undefined;

  try {
    await runGitWithOptionalCredentials(
      ["fetch", "origin", context.pr.headRefName],
      options.repoRoot,
    );
    await runCommand("git", ["branch", branchName, "FETCH_HEAD"], {
      cwd: options.repoRoot,
    });

    const sandcastleRun = await runSandcastleCodexFix(
      context,
      options.repoRoot,
      branchName,
      report,
    );
    worktreeRoot = sandcastleRun.preservedWorktreePath;
    if (worktreeRoot == null) {
      worktreeRoot = await mkdtemp(path.join(tmpdir(), "trizum-renovate-"));
      await runCommand("git", ["worktree", "add", worktreeRoot, branchName], {
        cwd: options.repoRoot,
      });
    }

    const localValidation = options.runLocalValidation
      ? await runLocalValidation(worktreeRoot)
      : {
          output: "Local validation skipped by workflow option.",
          passed: true,
        };

    const fallbackCommitCreated = await commitPendingAgentChanges(worktreeRoot, context);
    const sandcastleSummary = renderSandcastleSummary(sandcastleRun, fallbackCommitCreated);

    await runGitWithOptionalCredentials(["push", "-u", "origin", branchName], worktreeRoot);

    const bodyPath = path.join(worktreeRoot, ".trizum-superseding-pr-body.md");
    const body = renderSupersedingPullRequestBody(
      context,
      report,
      sandcastleSummary,
      localValidation,
    );
    await writeFile(bodyPath, body, "utf8");
    const labelArgs = localValidation.passed ? ["--label", options.readyForHumanReviewLabel] : [];
    const createResult = await gh(
      options,
      [
        "pr",
        "create",
        "--base",
        context.pr.baseRefName,
        "--head",
        branchName,
        "--title",
        context.pr.title,
        "--body-file",
        bodyPath,
        ...labelArgs,
      ],
      { cwd: worktreeRoot },
    );

    const prUrl = createResult.stdout.trim();
    const supersedingPrNumber = await readPullRequestNumberFromUrl(options, prUrl, worktreeRoot);
    if (localValidation.passed && supersedingPrNumber != null) {
      await addLabelToIssue(options, supersedingPrNumber, options.readyForHumanReviewLabel);
    }

    return {
      branchName,
      agentCommits: sandcastleRun.commits,
      agentLogPath: sandcastleRun.logFilePath,
      localValidationOutput: localValidation.output,
      localValidationPassed: localValidation.passed,
      prUrl,
      summary: truncateText(sandcastleSummary, 12_000),
    };
  } finally {
    if (worktreeRoot != null) {
      await runCommand("git", ["worktree", "remove", "--force", worktreeRoot], {
        allowFailure: true,
        cwd: options.repoRoot,
      });
      await rm(worktreeRoot, { force: true, recursive: true });
    }
  }
}

async function runGitWithOptionalCredentials(
  args: readonly string[],
  cwd: string,
): Promise<Awaited<ReturnType<typeof runCommand>>> {
  const token =
    process.env.TRIZUM_AGENT_WORKFLOWS_GIT_PUSH_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim();

  if (!token) {
    return runCommand("git", args, { cwd });
  }

  const authRoot = await mkdtemp(path.join(tmpdir(), "trizum-git-auth-"));
  const askpassPath = path.join(authRoot, "askpass.sh");

  try {
    await writeFile(
      askpassPath,
      [
        "#!/bin/sh",
        'case "$1" in',
        '*Username*) printf "%s\\n" "x-access-token" ;;',
        '*) printf "%s\\n" "$TRIZUM_AGENT_WORKFLOWS_GIT_PUSH_TOKEN" ;;',
        "esac",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(askpassPath, 0o700);

    return await runCommand("git", args, {
      cwd,
      env: {
        GIT_ASKPASS: askpassPath,
        GIT_TERMINAL_PROMPT: "0",
        TRIZUM_AGENT_WORKFLOWS_GIT_PUSH_TOKEN: token,
      },
    });
  } finally {
    await rm(authRoot, { force: true, recursive: true });
  }
}

async function runLocalValidation(worktreeRoot: string): Promise<LocalValidationResult> {
  const codexAuthCache = await hideCodexAuthCache();
  const commands = [
    ["vp", "run", "check"],
    ["vp", "run", "test"],
    ["vp", "run", "build"],
  ] as const;

  const environment = {
    ...createSanitizedEnvironment(),
    GIT_TERMINAL_PROMPT: "0",
  };
  const output: string[] = [];
  let passed = true;

  try {
    for (const [command, ...args] of commands) {
      const result = await runCommand(command, args, {
        allowFailure: true,
        cwd: worktreeRoot,
        env: environment,
        envMode: "replace",
        timeoutMs: 30 * 60 * 1000,
      });
      output.push(
        [
          `$ ${result.command}`,
          `exitCode: ${result.exitCode}`,
          truncateText(redactSecrets(result.stdout), 20_000),
          truncateText(redactSecrets(result.stderr), 20_000),
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (result.exitCode !== 0) {
        passed = false;
        break;
      }
    }
  } finally {
    await codexAuthCache.restore();
  }

  return {
    output: output.join("\n\n"),
    passed,
  };
}

async function hideCodexAuthCache(): Promise<{ restore: () => Promise<void> }> {
  const codexHome = process.env.CODEX_HOME?.trim();
  if (!codexHome) {
    return {
      restore: async () => {},
    };
  }

  const authFile = path.join(codexHome, "auth.json");
  const backupRoot = await mkdtemp(path.join(tmpdir(), "trizum-codex-auth-"));
  const backupFile = path.join(backupRoot, "auth.json");
  let moved = false;

  try {
    await rename(authFile, backupFile);
    moved = true;
  } catch (error) {
    await rm(backupRoot, { force: true, recursive: true });
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        restore: async () => {},
      };
    }
    throw error;
  }

  return {
    restore: async () => {
      try {
        if (moved) {
          await rename(backupFile, authFile);
        }
      } finally {
        await rm(backupRoot, { force: true, recursive: true });
      }
    },
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function commitPendingAgentChanges(
  worktreeRoot: string,
  context: PullRequestContext,
): Promise<boolean> {
  const status = await runCommand("git", ["status", "--short"], {
    cwd: worktreeRoot,
  });
  if (!status.stdout.trim()) {
    return false;
  }

  await runCommand("git", ["add", "-A"], {
    cwd: worktreeRoot,
  });
  await runCommand(
    "git",
    ["commit", "-m", `chore(deps): complete Renovate PR #${context.pr.number}`],
    {
      cwd: worktreeRoot,
    },
  );
  return true;
}

async function readPullRequestNumberFromUrl(
  options: WorkflowOptions,
  url: string,
  cwd: string,
): Promise<number | undefined> {
  if (!url) {
    return undefined;
  }

  const result = await gh(options, ["pr", "view", url, "--json", "number"], {
    allowFailure: true,
    cwd,
  });

  if (!result.stdout.trim()) {
    return undefined;
  }

  return Number.parseInt(String((JSON.parse(result.stdout) as { number?: number }).number), 10);
}

function renderReviewReport(decision: ReviewDecision): string {
  const combined = mergeReviewResults(decision.review.deterministic, decision.review.codex);
  const findings = renderFindings(combined.findings);

  return redactSecrets(
    [
      "## Agent Renovate Review",
      "",
      `Decision: ${decision.summary}`,
      "",
      `Original PR: #${decision.review.context.pr.number} ${decision.review.context.pr.title}`,
      `Checks: ${decision.review.context.pr.status.summary}`,
      "",
      "### Summary",
      combined.summary,
      "",
      "### Findings",
      findings,
      "",
      "### Changelog Notes",
      renderList(combined.changelogNotes),
      "",
      "### Automated Validation",
      renderList(combined.automatedTestSuggestions),
      "",
      "### Manual Test Plan",
      renderList(combined.manualTestPlan),
    ].join("\n"),
  );
}

function renderReviewComment(decision: ReviewDecision): string {
  const combined = mergeReviewResults(decision.review.deterministic, decision.review.codex);
  const context = decision.review.context;
  const updates =
    context.dependencyUpdates.length === 0
      ? "No parsed dependency update."
      : context.dependencyUpdates
          .map(
            (update) => `${update.name} ${update.from ?? "unknown"} -> ${update.to ?? "unknown"}`,
          )
          .join(", ");

  return redactSecrets(
    [
      "## Agent Renovate Review",
      "",
      `**Decision:** ${decision.summary}`,
      `**Checks:** ${context.pr.status.summary}`,
      `**Updates:** ${updates}`,
      "",
      `**Summary:** ${truncateText(firstParagraph(combined.summary), 700)}`,
      "",
      "**Findings:**",
      renderBriefFindings(combined.findings),
      "",
      "**Suggested validation:**",
      renderBriefList(combined.automatedTestSuggestions, 3),
      "",
      "**Manual smoke test:**",
      renderBriefList(combined.manualTestPlan, 3),
    ].join("\n"),
  );
}

function renderSupersedingPullRequestBody(
  context: PullRequestContext,
  report: string,
  agentSummary: string,
  localValidation: LocalValidationResult,
): string {
  return redactSecrets(
    [
      `Supersedes #${context.pr.number}.`,
      "",
      "This PR keeps the original Renovate update purpose and includes agent-applied fixes needed to make the update reviewable.",
      "",
      "## Sandcastle Codex Summary",
      truncateText(agentSummary, 12_000),
      "",
      "## Local Validation",
      `Status: ${localValidation.passed ? "passed" : "failed"}`,
      "",
      "```text",
      truncateText(localValidation.output, 30_000),
      "```",
      "",
      report,
    ].join("\n"),
  );
}

function renderSandcastleSummary(
  sandcastleRun: SandcastleFixRun,
  fallbackCommitCreated: boolean,
): string {
  return redactSecrets(
    [
      sandcastleRun.summary || "Sandcastle Codex run completed without a text summary.",
      "",
      `Branch: ${sandcastleRun.branchName}`,
      `Commits reported by Sandcastle: ${
        sandcastleRun.commits.length === 0 ? "none" : sandcastleRun.commits.join(", ")
      }`,
      fallbackCommitCreated ? "A fallback workflow commit captured uncommitted agent changes." : "",
      sandcastleRun.logFilePath == null ? "" : `Sandcastle log: ${sandcastleRun.logFilePath}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function renderFindings(findings: readonly ReviewFinding[]): string {
  if (findings.length === 0) {
    return "- No findings.";
  }

  return findings
    .map((finding) => {
      const file = finding.file == null ? "" : ` (${finding.file})`;
      return `- [${finding.severity}] ${finding.title}${file}: ${finding.details}`;
    })
    .join("\n");
}

function renderBriefFindings(findings: readonly ReviewFinding[]): string {
  if (findings.length === 0) {
    return "- No findings.";
  }

  return findings
    .slice(0, 3)
    .map((finding) => {
      const file = finding.file == null ? "" : ` (${finding.file})`;
      return `- [${finding.severity}] ${finding.title}${file}`;
    })
    .concat(
      findings.length > 3
        ? [`- ${findings.length - 3} more finding(s) in the full run output.`]
        : [],
    )
    .join("\n");
}

function renderList(values: readonly string[]): string {
  if (values.length === 0) {
    return "- None.";
  }

  return values.map((value) => `- ${value}`).join("\n");
}

function renderBriefList(values: readonly string[], limit: number): string {
  if (values.length === 0) {
    return "- None.";
  }

  return values
    .slice(0, limit)
    .map((value) => `- ${truncateText(value, 220)}`)
    .concat(
      values.length > limit
        ? [`- ${values.length - limit} more item(s) in the full run output.`]
        : [],
    )
    .join("\n");
}

function firstParagraph(value: string): string {
  return value.split(/\n\s*\n/)[0]?.trim() || value.trim();
}
