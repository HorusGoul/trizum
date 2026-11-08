import { readFile } from "node:fs/promises";
import {
  githubClient,
  publishImages,
  upsertComment,
  verifyImages,
  type GitHub,
} from "./github-publication.ts";
import { loadReport, renderComment, type CommentContext } from "./pr-report.ts";

interface Repository {
  id: number;
  full_name: string;
  private?: boolean;
}

interface Run {
  id: number;
  run_attempt: number;
  workflow_id: number;
  head_sha: string;
  head_branch: string;
  head_repository: Repository | null;
  event: string;
  path: string;
  status: string;
  conclusion: string | null;
}

interface PullRequest {
  number: number;
  state: string;
  head: { sha: string; ref: string; repo: Repository | null };
  base: { repo: Repository };
}

interface WorkflowRuns {
  workflow_runs: Run[];
}

interface Artifact {
  id: number;
  name: string;
  expired: boolean;
}

interface Artifacts {
  artifacts: Artifact[];
}

interface PublicationOptions {
  repository: string;
  runId: number;
  attempt: number;
  directory: string;
}

async function currentPull(api: GitHub, run: Run) {
  if (!run.head_repository) return;
  // Query GitHub, never take a PR number or SHA from the uploaded artifact.
  // This also works for forks where workflow_run.pull_requests can be empty.
  const head = `${run.head_repository.full_name.split("/")[0]}:${run.head_branch}`;

  const pulls = await api.request<PullRequest[]>(
    "GET",
    `pulls?state=open&head=${encodeURIComponent(head)}&per_page=100`,
  );

  return pulls.find(
    (pull) =>
      pull.head.sha === run.head_sha &&
      pull.head.ref === run.head_branch &&
      pull.head.repo?.id === run.head_repository?.id,
  );
}

async function isLatest(api: GitHub, run: Run, number: number) {
  const pull = await api.request<PullRequest>("GET", `pulls/${number}`);
  const fresh = await api.request<Run>("GET", `actions/runs/${run.id}`);
  const query = `event=pull_request&head_sha=${run.head_sha}&per_page=100`;

  const runs = await api.request<WorkflowRuns>(
    "GET",
    `actions/workflows/${run.workflow_id}/runs?${query}`,
  );

  return (
    pull.state === "open" &&
    pull.head.sha === run.head_sha &&
    pull.head.repo?.id === run.head_repository?.id &&
    fresh.run_attempt === run.run_attempt &&
    fresh.status === "completed" &&
    !runs.workflow_runs.some(
      (other) =>
        other.id > run.id &&
        other.head_branch === run.head_branch &&
        other.head_repository?.id === run.head_repository?.id,
    )
  );
}

export async function publishPRReport(api: GitHub, options: PublicationOptions, transport = fetch) {
  const run = await api.request<Run>("GET", `actions/runs/${options.runId}`);

  if (
    run.event !== "pull_request" ||
    run.path !== ".github/workflows/visual-regression.yml" ||
    run.status !== "completed" ||
    run.run_attempt !== options.attempt
  )
    return;

  const pull = await currentPull(api, run);

  if (
    !pull ||
    pull.base.repo.full_name !== options.repository ||
    !(await isLatest(api, run, pull.number))
  )
    return;

  const context: CommentContext = {
    runURL: `https://github.com/${options.repository}/actions/runs/${run.id}/attempts/${run.run_attempt}`,
    attempt: run.run_attempt,
    head: run.head_sha,
  };

  let failed = false;
  let body: string | undefined;

  try {
    const { artifacts } = await api.request<Artifacts>(
      "GET",
      `actions/runs/${run.id}/artifacts?per_page=100`,
    );

    const artifact = artifacts.find(
      (item) => item.name === `visual-comparison-${run.run_attempt}` && !item.expired,
    );

    if (artifact)
      context.reportURL = `https://github.com/${options.repository}/actions/runs/${run.id}/artifacts/${artifact.id}`;

    if (run.conclusion === "cancelled" || run.conclusion === "timed_out") {
      context.notice = `Visual comparison run ${run.conclusion === "cancelled" ? "was cancelled" : "timed out"}. Previous failure images have been cleared; this run does not establish visual parity.`;
    } else {
      if (
        !artifacts.some(
          (item) => item.name === `visual-pr-report-${run.run_attempt}` && !item.expired,
        )
      )
        throw new Error("Missing PR report artifact for this attempt");
      const { report, images } = await loadReport(options.directory);

      if (report.candidate !== run.head_sha) throw new Error("Report does not match PR head");

      if (
        run.conclusion === "success" &&
        report.passed === report.total &&
        !report.failures.length
      ) {
        context.notice = `**All ${report.total} visual comparisons passed.** Previous failure images have been cleared.`;
      } else if (report.failures.length) {
        const repository = await api.request<Repository>("GET", "");

        if (repository.private !== false)
          throw new Error("Public PNG publication requires a public repository");

        if (images.length) {
          const published = await publishImages(api, options.repository, images);
          await verifyImages(published, transport);
          context.images = new Map(published.map((image) => [image.name, image.url]));
          body = renderComment(context, report);
        } else {
          body = renderComment(context, report);
        }
      } else {
        context.notice =
          "The run did not complete a passing visual comparison suite. No failed comparison images are available; inspect the run logs and full report.";
      }
    }

    body ??= renderComment(context);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Unknown publication error"}\n`,
    );
    failed = true;
    body = renderComment({
      ...context,
      notice:
        "**Visual report publication failed.** Previous failure images have been cleared. Inspect the publisher logs and the comparison run/artifact; this does not change the visual check result.",
    });
  }

  // A push or rerun may have started while PNGs were being published.
  if (await isLatest(api, run, pull.number)) await upsertComment(api, pull.number, body);

  if (failed)
    throw new Error(
      "Visual report publication failed (missing/invalid artifact or inaccessible PNGs)",
    );
}

if (import.meta.main) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH!, "utf8"));
  await publishPRReport(githubClient(process.env.GITHUB_REPOSITORY!, process.env.GH_TOKEN!), {
    repository: process.env.GITHUB_REPOSITORY!,
    runId: event.workflow_run.id,
    attempt: event.workflow_run.run_attempt,
    directory: process.env.REPORT_DIRECTORY!,
  });
}
