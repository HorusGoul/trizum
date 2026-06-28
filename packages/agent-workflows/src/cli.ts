#!/usr/bin/env node
import path from "node:path";
import {
  REVIEW_LABEL,
  workflowOptionsSchema,
  type CodexMode,
  type WorkflowOptions,
} from "./schemas.js";
import { runRenovatePrReviewWorkflow } from "./workflows/renovate-pr-review.js";

interface CliOptions {
  json: boolean;
  workflowOptions: WorkflowOptions;
}

const helpText = `trizum-agent-workflows

Usage:
  trizum-agent-workflows renovate-pr-review [options]

Options:
  --pr <number>              Review a specific Renovate PR.
  --repo <owner/repo>        GitHub repository to pass to gh.
  --repo-root <path>         Local repository root. Defaults to the current directory.
  --write                    Apply write actions such as labels and comments.
  --dry-run                  Inspect only. This is the default.
  --supersede                Create a superseding PR when checks are failing. Implies --write.
  --comment                  Post the review report as a PR comment when writing.
  --label <name>             Label for review-ready PRs. Defaults to "${REVIEW_LABEL}".
  --codex <mode>             Codex mode: auto, required, or off. Defaults to auto.
  --no-codex                 Alias for --codex off.
  --no-local-validation      Skip local validation for superseding PR branches.
  --json                     Print the final workflow result as JSON.
  --help                     Show this help.

Environment:
  CODEX_ACCESS_TOKEN                     Optional Codex access token for subscription/workspace auth.
  TRIZUM_AGENT_WORKFLOWS_CODEX_MODEL     Optional Sandcastle Codex model. Defaults to gpt-5.
  TRIZUM_AGENT_WORKFLOWS_CODEX_EFFORT    Optional Sandcastle Codex effort: low, medium, high, xhigh.
`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const [command = "renovate-pr-review", ...args] = argv;

  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(helpText);
    return 0;
  }

  if (command !== "renovate-pr-review") {
    process.stderr.write(`Unknown workflow: ${command}\n\n${helpText}`);
    return 1;
  }

  const parsed = parseCliOptions(args);
  const result = await runRenovatePrReviewWorkflow(parsed.workflowOptions);

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`${result.report}\n`);
  if (result.supersedingPullRequest?.prUrl != null) {
    process.stdout.write(`\nSuperseding PR: ${result.supersedingPullRequest.prUrl}\n`);
  }
  if (result.labelAppliedTo != null) {
    process.stdout.write(
      `\nApplied label "${parsed.workflowOptions.readyForHumanReviewLabel}" to PR #${result.labelAppliedTo}.\n`,
    );
  }
  if (result.dryRun) {
    process.stdout.write(
      "\nDry run only. Re-run with --write to label/comment, or --supersede to create replacement PRs.\n",
    );
  }

  return 0;
}

export function parseCliOptions(args: readonly string[]): CliOptions {
  const options: WorkflowOptions = workflowOptionsSchema.parse({
    codexMode: "auto",
    mode: "dry-run",
    postReviewComment: false,
    readyForHumanReviewLabel: REVIEW_LABEL,
    repoRoot: process.cwd(),
    runLocalValidation: true,
    supersede: false,
  });
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--":
        break;
      case "--pr":
        options.prNumber = parsePositiveInteger(readValue(args, (index += 1), arg), arg);
        break;
      case "--repo":
        options.repository = readValue(args, (index += 1), arg);
        break;
      case "--repo-root":
        options.repoRoot = path.resolve(readValue(args, (index += 1), arg));
        break;
      case "--write":
        options.mode = "write";
        break;
      case "--dry-run":
        options.mode = "dry-run";
        break;
      case "--supersede":
        options.mode = "write";
        options.supersede = true;
        break;
      case "--comment":
        options.postReviewComment = true;
        break;
      case "--label":
        options.readyForHumanReviewLabel = readValue(args, (index += 1), arg);
        break;
      case "--codex":
        options.codexMode = parseCodexMode(readValue(args, (index += 1), arg));
        break;
      case "--no-codex":
        options.codexMode = "off";
        break;
      case "--no-local-validation":
        options.runLocalValidation = false;
        break;
      case "--json":
        json = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(helpText);
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return {
    json,
    workflowOptions: workflowOptionsSchema.parse(options),
  };
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index];
  if (value == null || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function parsePositiveInteger(value: string, option: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function parseCodexMode(value: string): CodexMode {
  if (value === "auto" || value === "off" || value === "required") {
    return value;
  }
  throw new Error("--codex must be one of: auto, off, required.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
