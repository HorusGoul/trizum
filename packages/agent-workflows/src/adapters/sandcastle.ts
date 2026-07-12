import { rm } from "node:fs/promises";
import { codex, Output, run, type AgentProvider } from "@ai-hero/sandcastle";
import { noSandbox } from "@ai-hero/sandcastle/sandboxes/no-sandbox";
import {
  reviewResultSchema,
  type CodexReviewResult,
  type PullRequestContext,
  type ReviewFinding,
  type ReviewResult,
} from "../schemas.js";
import {
  createSecretScrubEnvironmentOverrides,
  redactSecrets,
  runCommand,
  truncateText,
} from "./exec.js";

const CODEX_COMPLETION_SIGNAL = "<trizum-agent-workflows>DONE</trizum-agent-workflows>";
const REVIEW_OUTPUT_TAG = "trizum-review";

type CodexEffort = "low" | "medium" | "high" | "xhigh";

export interface SandcastleFixRun {
  branchName: string;
  commits: string[];
  logFilePath?: string;
  preservedWorktreePath?: string;
  summary: string;
}

export async function runSandcastleCodexReview(
  context: PullRequestContext,
  repoRoot: string,
): Promise<CodexReviewResult> {
  const branchName = `agent/review-renovate-pr-${context.pr.number}-${Date.now()}`;

  try {
    const result = await run({
      agent: createCodexAgent(),
      branchStrategy: {
        branch: branchName,
        type: "branch",
      },
      cwd: repoRoot,
      idleTimeoutSeconds: 20 * 60,
      name: `review-renovate-pr-${context.pr.number}`,
      output: Output.object({
        schema: reviewResultSchema,
        tag: REVIEW_OUTPUT_TAG,
      }),
      prompt: buildSandcastleReviewPrompt(context),
      sandbox: noSandbox({
        maxOutputTailChars: 256_000,
      }),
      timeouts: {
        commitCollectionMs: 60_000,
        copyToWorktreeMs: 120_000,
        gitSetupMs: 30_000,
        mergeToHostMs: 60_000,
      },
    });

    return {
      ...withReviewRunWarnings(result.output, result.commits),
      rawOutput: redactSecrets(result.stdout),
      ran: true,
    };
  } catch (error) {
    return {
      affectedAreas: [],
      automatedTestSuggestions: [],
      changelogNotes: [],
      error: error instanceof Error ? error.message : String(error),
      findings: [],
      manualTestPlan: [],
      ran: false,
      summary: "Sandcastle Codex review did not complete.",
    };
  } finally {
    await removeWorktreesForBranch(repoRoot, branchName);
    await runCommand("git", ["branch", "-D", branchName], {
      allowFailure: true,
      cwd: repoRoot,
    });
  }
}

export async function runSandcastleCodexFix(
  context: PullRequestContext,
  repoRoot: string,
  branchName: string,
  reviewReport?: string,
): Promise<SandcastleFixRun> {
  const result = await run({
    agent: createCodexAgent(),
    branchStrategy: {
      branch: branchName,
      type: "branch",
    },
    completionSignal: CODEX_COMPLETION_SIGNAL,
    completionTimeoutSeconds: 30,
    cwd: repoRoot,
    hooks: {
      host: {
        onWorktreeReady: [
          {
            command: `${buildCredentialEnvUnsetPrefix()} vp install --lockfile-only --no-frozen-lockfile --ignore-scripts || true`,
            timeoutMs: 10 * 60 * 1000,
          },
        ],
      },
    },
    idleTimeoutSeconds: 20 * 60,
    name: `renovate-pr-${context.pr.number}`,
    prompt: buildSandcastleFixPrompt(context, reviewReport),
    sandbox: noSandbox({
      maxOutputTailChars: 256_000,
    }),
    timeouts: {
      commitCollectionMs: 60_000,
      copyToWorktreeMs: 120_000,
      gitSetupMs: 30_000,
      mergeToHostMs: 60_000,
    },
  });

  return {
    branchName: result.branch,
    commits: result.commits.map((commit) => commit.sha),
    logFilePath: result.logFilePath,
    preservedWorktreePath: result.preservedWorktreePath,
    summary: summarizeSandcastleOutput(result.stdout),
  };
}

function resolveCodexModel(): string {
  return process.env.TRIZUM_AGENT_WORKFLOWS_CODEX_MODEL?.trim() || "gpt-5.6-sol";
}

function createCodexAgent(): AgentProvider {
  const model = resolveCodexModel();
  const agent = codex(model, {
    env: createSecretScrubEnvironmentOverrides({
      preserveCodexHome: true,
    }) as Record<string, string>,
    effort: resolveCodexEffort(),
  });

  return {
    ...agent,
    buildPrintCommand(options) {
      const command = agent.buildPrintCommand(options);
      return {
        ...command,
        command: addCodexExecFlags(command.command, ["--ignore-user-config"]),
      };
    },
  };
}

function addCodexExecFlags(command: string, flags: readonly string[]): string {
  if (!command.startsWith("codex exec ")) {
    return command;
  }

  const missingFlags = flags.filter((flag) => !command.includes(` ${flag}`));
  if (missingFlags.length === 0) {
    return command;
  }

  return command.replace("codex exec ", `codex exec ${missingFlags.join(" ")} `);
}

function resolveCodexEffort(): CodexEffort | undefined {
  const effort = process.env.TRIZUM_AGENT_WORKFLOWS_CODEX_EFFORT?.trim();
  if (effort === "low" || effort === "medium" || effort === "high" || effort === "xhigh") {
    return effort;
  }

  return "high";
}

function buildSandcastleReviewPrompt(context: PullRequestContext): string {
  return [
    "You are reviewing a Renovate dependency-update pull request in the trizum repository.",
    "",
    "Rules:",
    "- Do not edit files, commit, push, label, create a PR, merge, or delete branches.",
    "- Review the diff, dependency changelog/release-note sources, affected usage sites, failed checks, and test coverage.",
    "- Treat failed checks, missing lockfiles, incompatible API changes, or missing required follow-up code as blocker findings.",
    `- Return only a <${REVIEW_OUTPUT_TAG}> XML tag containing JSON matching this shape:`,
    '{ "summary": string, "affectedAreas": string[], "findings": [{ "severity": "blocker" | "warning" | "info", "title": string, "details": string, "file"?: string }], "manualTestPlan": string[], "automatedTestSuggestions": string[], "changelogNotes": string[] }',
    `- The final output must start with <${REVIEW_OUTPUT_TAG}> and end with </${REVIEW_OUTPUT_TAG}>.`,
    "",
    `Example wrapper: <${REVIEW_OUTPUT_TAG}>{"summary":"...","affectedAreas":[],"findings":[],"manualTestPlan":[],"automatedTestSuggestions":[],"changelogNotes":[]}</${REVIEW_OUTPUT_TAG}>`,
    "",
    "Pull request:",
    JSON.stringify(
      {
        affectedAreas: context.affectedAreas,
        dependencyMetadata: context.dependencyMetadata,
        dependencyUpdates: context.dependencyUpdates,
        failedCheckLogs: context.failedCheckLogs,
        files: context.files,
        pr: context.pr,
        usageMatches: context.usageMatches.slice(0, 100),
      },
      null,
      2,
    ),
    "",
    "Diff:",
    truncateText(context.diff, 120_000),
  ]
    .map(redactSecrets)
    .join("\n");
}

function buildSandcastleFixPrompt(context: PullRequestContext, reviewReport?: string): string {
  return [
    "You are completing a superseding pull request for a failing or blocked Renovate dependency-update PR in the trizum repository.",
    "",
    "Rules:",
    "- You may edit files in this Sandcastle-managed worktree.",
    "- Commit all file changes before finishing.",
    `- Use this commit message unless a narrower conventional commit is clearly better: chore(deps): complete Renovate PR #${context.pr.number}`,
    "- Include this trailer on every commit you create: Co-authored-by: Horus Lugo <horusgoul@gmail.com>",
    "- Do not push, label, create a PR, merge, delete branches, or edit the original Renovate PR.",
    "- Preserve the original dependency-upgrade purpose.",
    "- Fix only issues needed to make the upgrade reviewable.",
    "- Keep the superseding PR minimal; do not add or edit documentation unless missing documentation is the blocker.",
    "- If blocker findings point to Renovate grouping or configuration, update the Renovate configuration instead of forcing unrelated dependency changes.",
    "- Before finishing, read .agents/skills/deslop/SKILL.md and apply it to your diff so unnecessary docs, comments, defensive churn, and verbose summaries are removed.",
    "- Prefer the repo's existing patterns and Vite+ commands.",
    "- If no file changes are needed, explain why and do not create unrelated changes.",
    `- End your final response with this exact line: ${CODEX_COMPLETION_SIGNAL}`,
    "",
    "Context:",
    JSON.stringify(
      {
        affectedAreas: context.affectedAreas,
        dependencyMetadata: context.dependencyMetadata,
        dependencyUpdates: context.dependencyUpdates,
        failedCheckLogs: context.failedCheckLogs,
        files: context.files,
        pr: context.pr,
        usageMatches: context.usageMatches.slice(0, 100),
      },
      null,
      2,
    ),
    "",
    "Review report:",
    truncateText(reviewReport ?? "No review report was provided.", 40_000),
    "",
    "Diff:",
    truncateText(context.diff, 120_000),
  ]
    .map(redactSecrets)
    .join("\n");
}

function summarizeSandcastleOutput(output: string): string {
  return truncateText(redactSecrets(output).replace(CODEX_COMPLETION_SIGNAL, "").trim(), 12_000);
}

function buildCredentialEnvUnsetPrefix(): string {
  return [
    "env",
    "-u BOT_GITHUB_TOKEN",
    "-u BW_ACCESS_TOKEN",
    "-u BWS_ACCESS_TOKEN",
    "-u CODEX_ACCESS_TOKEN",
    "-u CODEX_AUTH_JSON",
    "-u CODEX_HOME",
    "-u GH_TOKEN",
    "-u GITHUB_TOKEN",
    "-u OPENAI_API_KEY",
    "-u TRIZUM_AGENT_WORKFLOWS_GIT_PUSH_TOKEN",
    "-u TRIZUM_AGENT_WORKFLOWS_GITHUB_TOKEN",
  ].join(" ");
}

function withReviewRunWarnings(
  review: ReviewResult,
  commits: readonly { sha: string }[],
): ReviewResult {
  if (commits.length === 0) {
    return review;
  }

  const warning: ReviewFinding = {
    details:
      "The review agent created commits on a disposable Sandcastle review branch. The workflow deleted the branch after the run.",
    severity: "warning",
    title: "Review agent modified its disposable branch",
  };

  return {
    ...review,
    findings: [...review.findings, warning],
  };
}

async function removeWorktreesForBranch(repoRoot: string, branchName: string): Promise<void> {
  const result = await runCommand("git", ["worktree", "list", "--porcelain"], {
    allowFailure: true,
    cwd: repoRoot,
  });
  const refName = `refs/heads/${branchName}`;
  const paths = parseWorktreePathsForBranch(result.stdout, refName);

  await Promise.all(
    paths.map(async (worktreePath) => {
      await runCommand("git", ["worktree", "remove", "--force", worktreePath], {
        allowFailure: true,
        cwd: repoRoot,
      });
      await rm(worktreePath, {
        force: true,
        recursive: true,
      });
    }),
  );
}

function parseWorktreePathsForBranch(output: string, refName: string): string[] {
  const paths: string[] = [];
  let currentPath: string | undefined;
  let currentBranch: string | undefined;

  for (const line of [...output.split(/\r?\n/), ""]) {
    if (!line) {
      if (currentPath != null && currentBranch === refName) {
        paths.push(currentPath);
      }
      currentPath = undefined;
      currentBranch = undefined;
      continue;
    }

    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length);
      continue;
    }

    if (line.startsWith("branch ")) {
      currentBranch = line.slice("branch ".length);
    }
  }

  return paths;
}
