import { describe, expect, it } from "vite-plus/test";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";
import VisualReporter from "../../../e2e/visual/reporter";

describe("visual report finalization", () => {
  it("waits for pending attachments and includes the result in both outputs", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "trizum-reporter-"));
    const attachment = path.join(directory, "pending.png");
    await promisify(execFile)("mkfifo", [attachment]);

    try {
      const reporter = new VisualReporter({ outputDir: directory });
      reporter.onBegin({ metadata: { reference: "main", candidate: "branch" } });
      reporter.onTestEnd(
        {
          parent: { project: () => ({ name: "webkit-mobile" }) },
          titlePath: () => ["en", "menu"],
        },
        {
          status: "passed",
          errors: [],
          attachments: [{ name: "origin-main", path: attachment, contentType: "image/png" }],
        },
      );
      let finished = false;

      const finalization = reporter.onExit().then(() => {
        finished = true;
      });

      // Hold the real file read pending through finalization, then release it.
      await setTimeout(50);
      const completedBeforeRelease = finished;
      await writeFile(attachment, "image");
      await finalization;
      expect(completedBeforeRelease).toBe(false);
      const html = await readFile(path.join(directory, "comparison.html"), "utf8");
      const summary = JSON.parse(await readFile(path.join(directory, "summary.json"), "utf8"));
      expect(summary).toMatchObject({
        total: 1,
        passed: 1,
        comparisons: [{ name: "webkit-mobile: en / menu", status: "passed" }],
      });
      expect(html).toContain("1/1 comparisons passed");
      expect(html).toContain("data:image/png;base64,aW1hZ2U=");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
