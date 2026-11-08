import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const commentMarker = "<!-- trizum-visual-regression -->";
export const reportBranch = "visual-regression-reports";

export interface Failure {
  project: string;
  test: string;
  status: string;
  before?: string;
  after?: string;
  diff?: string;
}

export interface VisualReport {
  version: number;
  reference: string;
  candidate: string;
  total: number;
  passed: number;
  failures: Failure[];
}

export interface ReportImage {
  name: string;
  bytes: Buffer;
}

export interface LoadedReport {
  report: VisualReport;
  images: ReportImage[];
}

// Only generated filenames are accepted: never follow artifact paths or symlinks.
async function readRegularFile(directory: string, name: string, limit: number) {
  const file = path.join(directory, name);
  const stat = await lstat(file);

  if (!stat.isFile() || stat.size > limit) throw new Error(`Invalid report file: ${name}`);

  return readFile(file);
}

function validLabel(value: string) {
  // Runtime checks are necessary at this untrusted JSON boundary.
  // eslint-disable-next-line anti-slop/no-runtime-typeof
  return typeof value === "string" && value.length > 0 && value.length <= 300;
}

export async function loadReport(directory: string): Promise<LoadedReport> {
  const directoryStat = await lstat(directory);

  if (!directoryStat.isDirectory()) throw new Error("Invalid report directory");
  const bytes = await readRegularFile(directory, "report.json", 256_000);
  // The JSON is untrusted. Every consumed field is validated below before use.
  const report: VisualReport = JSON.parse(bytes.toString("utf8"));

  if (
    !report ||
    report.version !== 1 ||
    !validLabel(report.reference) ||
    !validLabel(report.candidate) ||
    !Number.isInteger(report.total) ||
    report.total < 1 ||
    report.total > 500 ||
    !Number.isInteger(report.passed) ||
    report.passed < 0 ||
    report.passed > report.total ||
    !Array.isArray(report.failures) ||
    report.failures.length > report.total ||
    report.passed + report.failures.length > report.total
  )
    throw new Error("Invalid visual report");

  const images: ReportImage[] = [];
  const seen = new Set<string>();
  let size = 0;

  for (const failure of report.failures) {
    if (
      !failure ||
      !validLabel(failure.project) ||
      !validLabel(failure.test) ||
      !["failed", "timedOut", "interrupted"].includes(failure.status)
    ) {
      throw new Error("Invalid failed comparison");
    }

    for (const name of [failure.before, failure.after, failure.diff]) {
      if (name === undefined) continue;

      if (!validLabel(name) || !/^\d+-(before|after|diff)\.png$/.test(name)) {
        throw new Error("Invalid image path");
      }

      if (seen.has(name)) continue;

      const bytes = await readRegularFile(directory, name, 5_000_000);

      if (!bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
        throw new Error("Report image is not PNG");
      }

      size += bytes.length;

      if (size > 50_000_000) throw new Error("Report images exceed 50 MB");

      images.push({ name, bytes });
      seen.add(name);
    }
  }

  return { report, images };
}

function label(value: string) {
  // Numeric entities also neutralize Markdown, mentions, and newlines in PR data.
  return Array.from(value, (character) =>
    /[a-zA-Z0-9 /:._-]/.test(character) ? character : `&#${character.codePointAt(0)};`,
  ).join("");
}

export interface CommentContext {
  runURL: string;
  attempt: number;
  head: string;
  images?: ReadonlyMap<string, string>;
  reportURL?: string;
  notice?: string;
}

export function renderComment(context: CommentContext, report?: VisualReport) {
  let body = `${commentMarker}\n### Visual regression report\n\nCommit: \`${context.head}\` · [Run (attempt ${context.attempt})](${context.runURL})`;

  if (context.reportURL) body += ` · [Full report (download)](${context.reportURL})`;
  body += "\n\n";

  if (context.notice) return body + context.notice;

  if (!report) return body + "No comparison report was produced. Inspect the run logs.";

  body += `**${report.failures.length} failed comparison(s)** · ${report.passed}/${report.total} passed.\n\nBaseline: \`${label(report.reference)}\`\n\n`;
  body +=
    "Review the images when deciding whether to approve or reject this PR. Intentional differences still fail the visual check; this report does not approve them.\n\n";

  for (const failure of report.failures) {
    const image = (name: string | undefined, alt: string) =>
      name && context.images?.has(name)
        ? `![${alt}](${context.images.get(name)})`
        : "No image captured";

    const section = `<details>\n<summary>${label(failure.project)} · ${label(failure.test)} (${label(failure.status)})</summary>\n\n| Baseline — before | PR — after |\n| --- | --- |\n| ${image(failure.before, "Baseline before")} | ${image(failure.after, "PR after")} |\n\n${failure.diff ? `**Diff**\n\n${image(failure.diff, "Pixel differences")}\n\n` : ""}</details>\n\n`;

    if (body.length + section.length > 60_000) {
      body += "Remaining failures are in the full report linked above (comment size limit).\n";
      break;
    }

    body += section;
  }

  return body;
}
