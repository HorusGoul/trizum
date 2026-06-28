import type {
  CheckRun,
  CheckStatus,
  DependencyMetadata,
  DependencyUpdate,
  PullRequestContext,
  RenovatePullRequest,
  ReviewFinding,
  ReviewResult,
  UsageMatch,
} from "../schemas.js";

const manifestFilePattern = /(^|\/)(package\.json|pnpm-workspace\.yaml)$/;
const versionLinePattern = /^[+-]\s{2,}"(?<name>[^"]+)":\s*"(?<version>[^"]+)"[,]?$/;
const yamlVersionLinePattern =
  /^[+-]\s+(?<name>["']?(?:@?[\w.-]+\/)?[\w.-]+["']?):\s*(?<version>.+)$/;
const ignoredManifestKeys = new Set([
  "author",
  "description",
  "license",
  "name",
  "packageManager",
  "type",
  "version",
]);

export interface RawGhPullRequest {
  author?: {
    login?: string;
  };
  baseRefName?: string;
  createdAt?: string;
  headRefName?: string;
  isDraft?: boolean;
  labels?: Array<{
    name?: string;
  }>;
  mergeStateStatus?: string;
  number?: number;
  title?: string;
  updatedAt?: string;
  url?: string;
}

export function isRenovatePullRequest(
  pr: Pick<RenovatePullRequest, "authorLogin" | "headRefName" | "title">,
): boolean {
  const author = pr.authorLogin.toLowerCase();
  const head = pr.headRefName.toLowerCase();
  const title = pr.title.toLowerCase();

  return (
    author.includes("renovate") ||
    head.startsWith("renovate/") ||
    title.includes("renovate") ||
    title.startsWith("chore(deps")
  );
}

export function normalizeGhPullRequest(
  raw: RawGhPullRequest,
  status: CheckStatus,
): RenovatePullRequest {
  if (
    raw.number == null ||
    raw.title == null ||
    raw.headRefName == null ||
    raw.baseRefName == null
  ) {
    throw new Error(`GitHub PR payload is missing required fields: ${JSON.stringify(raw)}`);
  }

  return {
    authorLogin: raw.author?.login ?? "",
    baseRefName: raw.baseRefName,
    createdAt: raw.createdAt,
    headRefName: raw.headRefName,
    isDraft: raw.isDraft ?? false,
    labels: (raw.labels ?? [])
      .map((label) => label.name)
      .filter((name): name is string => name != null),
    number: raw.number,
    status,
    title: raw.title,
    updatedAt: raw.updatedAt,
    url: raw.url ?? "",
  };
}

export function classifyCheckStatus(checks: readonly CheckRun[]): CheckStatus {
  const failing = checks.filter((check) => check.bucket === "fail" || check.bucket === "cancel");
  const pending = checks.filter((check) => check.bucket === "pending");
  const passing = checks.filter((check) => check.bucket === "pass");
  const skipping = checks.filter((check) => check.bucket === "skipping");

  let conclusion: CheckStatus["conclusion"] = "unknown";
  if (failing.length > 0) {
    conclusion = "fail";
  } else if (pending.length > 0) {
    conclusion = "pending";
  } else if (passing.length > 0 || skipping.length > 0) {
    conclusion = "pass";
  }

  const summary =
    checks.length === 0
      ? "No checks reported."
      : `${passing.length} passing, ${failing.length} failing, ${pending.length} pending, ${skipping.length} skipped.`;

  return {
    conclusion,
    failing,
    passing,
    pending,
    skipping,
    summary,
  };
}

export function pickRenovatePullRequest(
  candidates: readonly RenovatePullRequest[],
  requestedNumber?: number,
): RenovatePullRequest {
  if (requestedNumber != null) {
    const requested = candidates.find((candidate) => candidate.number === requestedNumber);
    if (requested == null) {
      throw new Error(`Could not find open Renovate PR #${requestedNumber}.`);
    }
    return requested;
  }

  const sorted = [...candidates].sort((a, b) => {
    const statusPriority =
      statusPriorityForSelection(b.status.conclusion) -
      statusPriorityForSelection(a.status.conclusion);
    if (statusPriority !== 0) {
      return statusPriority;
    }

    const aTime = Date.parse(a.updatedAt ?? a.createdAt ?? "");
    const bTime = Date.parse(b.updatedAt ?? b.createdAt ?? "");
    return (aTime || 0) - (bTime || 0);
  });

  const picked = sorted.find((candidate) => !candidate.isDraft) ?? sorted[0];
  if (picked == null) {
    throw new Error("No open Renovate PRs were found.");
  }

  return picked;
}

function statusPriorityForSelection(conclusion: CheckStatus["conclusion"]): number {
  switch (conclusion) {
    case "fail":
      return 4;
    case "pending":
      return 3;
    case "unknown":
      return 2;
    case "pass":
      return 1;
  }
}

export function parseDependencyUpdatesFromDiff(diff: string): DependencyUpdate[] {
  const updates = new Map<string, DependencyUpdate>();
  let currentFile = "";
  const removed = new Map<string, string>();

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      currentFile = parseDiffFile(line);
      removed.clear();
      continue;
    }

    if (!manifestFilePattern.test(currentFile)) {
      continue;
    }

    const removedMatch = parseVersionLine(line, "-");
    if (removedMatch != null) {
      if (!ignoredManifestKeys.has(removedMatch.name)) {
        removed.set(removedMatch.name, removedMatch.version);
      }
      continue;
    }

    const addedMatch = parseVersionLine(line, "+");
    if (addedMatch == null || ignoredManifestKeys.has(addedMatch.name)) {
      continue;
    }

    const from = removed.get(addedMatch.name);
    const key = `${currentFile}:${addedMatch.name}`;
    updates.set(key, {
      file: currentFile,
      from,
      name: addedMatch.name,
      to: addedMatch.version,
    });
  }

  return [...updates.values()].filter((update) => update.from !== update.to);
}

export function parseDependencyUpdatesFromRenovateBody(body: string): DependencyUpdate[] {
  const updates: DependencyUpdate[] = [];

  for (const line of body.split(/\r?\n/)) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 4 || cells[0] === "Package" || /^-+$/.test(cells[0])) {
      continue;
    }

    const changeMatch = /`?(?<from>[^`→]+?)`?\s*→\s*`?(?<to>[^`]+?)`?$/.exec(cells[3]);
    if (changeMatch?.groups == null) {
      continue;
    }

    const name = (/\[(?<name>[^\]]+)\]/.exec(cells[0])?.groups?.name ?? cells[0]).trim();
    if (!name || ignoredManifestKeys.has(name)) {
      continue;
    }

    updates.push({
      file: "renovate-pr-body",
      from: changeMatch.groups.from.trim(),
      name,
      to: changeMatch.groups.to.trim(),
    });
  }

  return updates;
}

export function mergeDependencyUpdates(updates: readonly DependencyUpdate[]): DependencyUpdate[] {
  const merged = new Map<string, DependencyUpdate>();

  for (const update of updates) {
    const key = `${update.file}:${update.name}:${update.from ?? ""}:${update.to ?? ""}`;
    merged.set(key, update);
  }

  return [...merged.values()];
}

function parseDiffFile(line: string): string {
  const parts = line.split(" ");
  const target = parts[3] ?? parts[2] ?? "";
  return target.replace(/^b\//, "").replace(/^a\//, "");
}

function parseVersionLine(
  line: string,
  prefix: "+" | "-",
): { name: string; version: string } | undefined {
  if (!line.startsWith(prefix) || line.startsWith(`${prefix}${prefix}${prefix}`)) {
    return undefined;
  }

  const jsonMatch = versionLinePattern.exec(line);
  if (jsonMatch?.groups != null) {
    return {
      name: jsonMatch.groups.name,
      version: jsonMatch.groups.version,
    };
  }

  const yamlMatch = yamlVersionLinePattern.exec(line);
  if (yamlMatch?.groups == null) {
    return undefined;
  }

  const version = yamlMatch.groups.version.trim().replace(/^["']|["']$/g, "");
  if (!looksLikeVersion(version)) {
    return undefined;
  }

  return {
    name: yamlMatch.groups.name.replace(/^["']|["']$/g, ""),
    version,
  };
}

function looksLikeVersion(value: string): boolean {
  return (
    /^(\^|~)?\d+\.\d+/.test(value) ||
    /^(latest|next|catalog:|workspace:|npm:)/.test(value) ||
    /^\d{4}\.\d{1,2}\.\d{1,2}/.test(value)
  );
}

export function inferAffectedAreas(
  files: readonly string[],
  updates: readonly DependencyUpdate[],
): string[] {
  const areas = new Set<string>();

  for (const file of files) {
    if (file.startsWith("packages/pwa/")) {
      areas.add("pwa");
    } else if (file.startsWith("packages/server/")) {
      areas.add("server");
    } else if (file.startsWith("packages/mobile/")) {
      areas.add("mobile");
    } else if (file.startsWith(".github/")) {
      areas.add("github-actions");
    } else if (
      file === "pnpm-workspace.yaml" ||
      file === "pnpm-lock.yaml" ||
      file === "package.json"
    ) {
      areas.add("workspace");
    }
  }

  for (const update of updates) {
    if (/^@capacitor\/|^@capawesome\/|capacitor/.test(update.name)) {
      areas.add("mobile");
    }
    if (/^@automerge\//.test(update.name)) {
      areas.add("collaboration");
    }
    if (/^@lingui\/|lingui/.test(update.name)) {
      areas.add("i18n");
    }
    if (/^@playwright\/|playwright/.test(update.name)) {
      areas.add("e2e");
    }
    if (/^@sentry\/|^@logtape\//.test(update.name)) {
      areas.add("observability");
    }
    if (/^@tanstack\//.test(update.name)) {
      areas.add("routing-and-forms");
    }
    if (/^react$|^react-dom$|react-aria|react-window|motion/.test(update.name)) {
      areas.add("pwa");
    }
    if (/^hono$|^@hono\/|drizzle|libsql/.test(update.name)) {
      areas.add("server");
    }
  }

  return [...areas].sort();
}

export function buildDeterministicReview(context: PullRequestContext): ReviewResult {
  const findings: ReviewFinding[] = [];

  if (context.dependencyUpdates.length === 0) {
    findings.push({
      details:
        "No dependency version changes were detected in package manifests or the workspace catalog.",
      severity: "warning",
      title: "No parsed dependency update",
    });
  }

  if (context.pr.status.conclusion === "fail") {
    findings.push({
      details:
        context.pr.status.failing.map((check) => check.name).join(", ") ||
        context.pr.status.summary,
      severity: "blocker",
      title: "PR checks are failing",
    });
  }

  if (
    context.files.includes("pnpm-lock.yaml") === false &&
    context.files.some((file) => manifestFilePattern.test(file))
  ) {
    findings.push({
      details:
        "A dependency manifest changed without pnpm-lock.yaml. This repo expects Renovate lockfiles to be refreshed with Vite+.",
      file: "pnpm-lock.yaml",
      severity: "blocker",
      title: "Missing lockfile update",
    });
  }

  const changelogNotes = context.dependencyMetadata.map(formatDependencyMetadataNote);

  return {
    affectedAreas: context.affectedAreas,
    automatedTestSuggestions: buildAutomatedTestSuggestions(context.affectedAreas),
    changelogNotes,
    findings,
    manualTestPlan: buildManualTestPlan(context.affectedAreas),
    summary: summarizeContext(context),
  };
}

function formatDependencyMetadataNote(metadata: DependencyMetadata): string {
  const source = metadata.changelogUrl ?? metadata.repositoryUrl ?? metadata.homepage;
  return source == null
    ? `${metadata.name}: no changelog or repository URL found from npm metadata.`
    : `${metadata.name}: inspect ${source}`;
}

function summarizeContext(context: PullRequestContext): string {
  const dependencyText =
    context.dependencyUpdates.length === 0
      ? "no parsed dependency updates"
      : context.dependencyUpdates
          .map(
            (update) =>
              `${update.name}${update.from != null || update.to != null ? ` ${update.from ?? "?"} -> ${update.to ?? "?"}` : ""}`,
          )
          .join(", ");

  return `Reviewed ${context.pr.title} (#${context.pr.number}); affected areas: ${context.affectedAreas.join(", ") || "unknown"}; updates: ${dependencyText}.`;
}

export function buildManualTestPlan(affectedAreas: readonly string[]): string[] {
  const plan = new Set<string>();

  if (affectedAreas.includes("pwa")) {
    plan.add(
      "Run the PWA locally, create or edit a bill, split participants, and reload while offline.",
    );
  }
  if (affectedAreas.includes("server") || affectedAreas.includes("collaboration")) {
    plan.add(
      "Start the sync server and verify a document can sync over the Automerge websocket path.",
    );
  }
  if (affectedAreas.includes("mobile")) {
    plan.add(
      "Run the mobile wrapper smoke flow for sign-in, camera/share permissions, and safe-area rendering.",
    );
  }
  if (affectedAreas.includes("i18n")) {
    plan.add(
      "Switch locales and verify extracted Lingui messages still render on core app screens.",
    );
  }
  if (affectedAreas.includes("e2e")) {
    plan.add(
      "Run a representative Playwright journey in headed mode to confirm browser-driver compatibility.",
    );
  }
  if (affectedAreas.includes("observability")) {
    plan.add(
      "Exercise startup and one handled error path to confirm logging and Sentry initialization still work.",
    );
  }
  if (plan.size === 0) {
    plan.add("Smoke-test the area owning the changed package manifests.");
  }

  return [...plan];
}

export function buildAutomatedTestSuggestions(affectedAreas: readonly string[]): string[] {
  const suggestions = new Set(["vp run check", "vp run test", "vp run build"]);

  if (affectedAreas.includes("pwa")) {
    suggestions.add("vp run --filter @trizum/pwa test");
  }
  if (affectedAreas.includes("server")) {
    suggestions.add("vp run --filter @trizum/server check");
  }
  if (affectedAreas.includes("e2e")) {
    suggestions.add("vp run test:e2e");
  }
  if (affectedAreas.includes("mobile")) {
    suggestions.add("cd packages/mobile && vp run build");
  }

  return [...suggestions];
}

export function mergeReviewResults(deterministic: ReviewResult, codex: ReviewResult): ReviewResult {
  return {
    affectedAreas: dedupeStrings([...deterministic.affectedAreas, ...codex.affectedAreas]),
    automatedTestSuggestions: dedupeStrings([
      ...deterministic.automatedTestSuggestions,
      ...codex.automatedTestSuggestions,
    ]),
    changelogNotes: dedupeStrings([...deterministic.changelogNotes, ...codex.changelogNotes]),
    findings: [...deterministic.findings, ...codex.findings],
    manualTestPlan: dedupeStrings([...deterministic.manualTestPlan, ...codex.manualTestPlan]),
    summary: [deterministic.summary, codex.summary].filter(Boolean).join("\n\n"),
  };
}

export function hasBlockingFindings(review: Pick<ReviewResult, "findings">): boolean {
  return review.findings.some((finding) => finding.severity === "blocker");
}

export function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function parseRgUsage(stdout: string): UsageMatch[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => {
      const match = /^(?<file>.*?):(?<line>\d+):(?<text>.*)$/.exec(line);
      if (match?.groups == null) {
        return undefined;
      }

      return {
        file: match.groups.file,
        line: Number.parseInt(match.groups.line, 10),
        text: match.groups.text.trim(),
      } satisfies UsageMatch;
    })
    .filter((match): match is UsageMatch => match != null);
}
