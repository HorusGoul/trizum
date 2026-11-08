/// <reference types="node" />

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Failure } from "./pr-report.ts";
import type { FullConfig, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

interface Comparison {
  name: string;
  project: string;
  test: string;
  status: string;
  reference?: string;
  candidate?: string;
  diff?: string;
  error?: string;
}

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

async function image(file?: string) {
  return file ? `data:image/png;base64,${(await readFile(file)).toString("base64")}` : undefined;
}

export default class VisualReporter implements Reporter {
  private results: {
    name: string;
    project: string;
    test: string;
    result: Pick<TestResult, "status" | "attachments" | "errors">;
  }[] = [];
  private outputDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir =
      options.outputDir ?? fileURLToPath(new URL("../../visual-report", import.meta.url));
  }
  private reference = "";
  private candidate = "";

  onBegin(config: Pick<FullConfig, "metadata">) {
    this.reference = String(config.metadata.reference);
    this.candidate = String(config.metadata.candidate);
  }

  onTestEnd(
    test: Pick<TestCase, "titlePath"> & { parent: { project(): { name: string } | undefined } },
    result: Pick<TestResult, "status" | "attachments" | "errors">,
  ) {
    this.results.push({
      name: `${test.parent.project()?.name}: ${test.titlePath().slice(-2).join(" / ")}`,
      project: test.parent.project()?.name ?? "unknown",
      test: test.titlePath().slice(-2).join(" / "),
      result,
    });
  }

  async onExit() {
    // Playwright does not await onTestEnd; load attachments during finalization.
    const comparisons: Comparison[] = await Promise.all(
      this.results.map(async ({ name, project, test, result }) => ({
        name,
        project,
        test,
        status: result.status,
        reference: await image(
          result.attachments.find((attachment) => attachment.name === "origin-main")?.path,
        ),
        candidate: await image(
          result.attachments.find((attachment) => attachment.name === "design-system-branch")?.path,
        ),
        diff: await image(
          result.attachments.find((attachment) => attachment.path?.endsWith("-diff.png"))?.path,
        ),
        error: result.errors.map((error) => error.message ?? "").join("\n"),
      })),
    );

    const passed = comparisons.filter((comparison) => comparison.status === "passed").length;

    const cards = comparisons
      .map((comparison, index) => {
        const frame = (label: string, source?: string) =>
          `<figure><figcaption>${label}</figcaption>${source ? `<a href="${source}" target="_blank"><img src="${source}" alt="${escape(comparison.name)} — ${label}"></a>` : "<p>No image captured</p>"}</figure>`;

        return `<section data-comparison="${index}" ${index ? "hidden" : ""}><h2>${escape(comparison.name)}</h2><p>${escape(comparison.status)}</p><div class="images">${frame("origin/main", comparison.reference)}${frame("Design-system branch", comparison.candidate)}</div>${comparison.diff ? frame("Pixel differences", comparison.diff) : ""}${comparison.error ? `<details><summary>Failure details</summary><pre>${escape(comparison.error)}</pre></details>` : ""}</section>`;
      })
      .join("");

    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design-system visual comparison</title><style>
      body{font-family:var(--font-sans,system-ui);color:var(--foreground,CanvasText)}
      p,figcaption{color:var(--muted-foreground,GrayText)}code,pre{font-family:var(--font-mono,monospace)}
      select{max-width:100%;padding:8px;margin:8px 0 16px}section{padding:16px;border-radius:var(--radius,12px);background:var(--card,Canvas)}
      h2{font-size:16px;margin:0}figure{margin:0;min-width:0}figcaption{margin:8px 0}.images{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{display:block;max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}details{margin-top:16px}
    </style><p><strong>${passed}/${comparisons.length} comparisons passed.</strong> Same browser, viewport, fixture data, locale, hue, and fixed date.</p><p>Reference: <code>${escape(this.reference)}</code><br>Candidate: <code>${escape(this.candidate)}</code></p><label for="screen">Comparison</label><br><select id="screen">${comparisons.map((comparison, index) => `<option value="${index}">${escape(comparison.name)} — ${escape(comparison.status)}</option>`).join("")}</select>${cards}<script>document.getElementById('screen').addEventListener('change',event=>{for(const section of document.querySelectorAll('[data-comparison]'))section.hidden=section.dataset.comparison!==event.target.value;});</script></html>`;

    await mkdir(this.outputDir, { recursive: true });
    await writeFile(path.join(this.outputDir, "comparison.html"), html);
    await writeFile(
      path.join(this.outputDir, "summary.json"),
      JSON.stringify(
        {
          reference: this.reference,
          candidate: this.candidate,
          passed,
          total: comparisons.length,
          comparisons: comparisons.map(({ name, status, error }) => ({ name, status, error })),
        },
        null,
        2,
      ),
    );
    // A small, data-only artifact crosses into the trusted PR publisher.
    const reportDir = path.join(this.outputDir, "github-report");
    await mkdir(reportDir, { recursive: true });
    const failures = [];

    for (const [index, comparison] of comparisons.entries()) {
      if (!["failed", "timedOut", "interrupted"].includes(comparison.status)) continue;

      const files: Pick<Failure, "before" | "after" | "diff"> = {};

      for (const [role, source] of [
        ["before", comparison.reference],
        ["after", comparison.candidate],
        ["diff", comparison.diff],
      ] as const) {
        if (!source) continue;

        const filename = `${index}-${role}.png`;
        await writeFile(
          path.join(reportDir, filename),
          Buffer.from(source.split(",")[1], "base64"),
        );
        files[role] = filename;
      }

      failures.push({
        project: comparison.project,
        test: comparison.test,
        status: comparison.status,
        ...files,
      });
    }

    await writeFile(
      path.join(reportDir, "report.json"),
      JSON.stringify({
        version: 1,
        reference: this.reference,
        candidate: this.candidate,
        total: comparisons.length,
        passed,
        failures,
      }),
    );
    process.stdout.write(
      `Visual comparison report: ${path.join(this.outputDir, "comparison.html")}\n`,
    );
  }
}
