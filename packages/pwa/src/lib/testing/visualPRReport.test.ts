import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  githubClient,
  publishImages,
  upsertComment,
  verifyImages,
} from "../../../e2e/visual/github-publication";
import {
  loadReport,
  renderComment,
  commentMarker,
  type VisualReport,
} from "../../../e2e/visual/pr-report";
import { publishPRReport } from "../../../e2e/visual/publish-pr-report";
import VisualReporter from "../../../e2e/visual/reporter";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
  "base64",
);

const head = "a".repeat(40);
const repository = "HorusGoul/trizum";
const directories: string[] = [];

const report = (): VisualReport => ({
  version: 1,
  reference: "b".repeat(40),
  candidate: head,
  total: 2,
  passed: 1,
  failures: [
    {
      project: "webkit-mobile",
      test: "es / party-settings matches origin/main",
      status: "failed",
      before: "1-before.png",
      after: "1-after.png",
      diff: "1-diff.png",
    },
  ],
});

async function fixture(data = report()) {
  const directory = await mkdtemp(path.join(tmpdir(), "trizum-pr-report-"));
  directories.push(directory);
  await writeFile(path.join(directory, "report.json"), JSON.stringify(data));

  for (const name of ["1-before.png", "1-after.png", "1-diff.png"])
    await writeFile(path.join(directory, name), png);

  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function server() {
  const run = {
    id: 10,
    run_attempt: 2,
    workflow_id: 123,
    head_sha: head,
    head_branch: "change-ui",
    // Simulate a fork, including no workflow_run.pull_requests association.
    head_repository: { id: 456, full_name: "contributor/trizum" },
    event: "pull_request",
    path: ".github/workflows/visual-regression.yml",
    status: "completed",
    conclusion: "failure",
  };

  const pull = {
    number: 99,
    state: "open",
    head: { sha: head, ref: run.head_branch, repo: run.head_repository },
    base: { repo: { full_name: repository } },
  };

  const state = {
    run,
    pull,
    newer: false,
    comments: [
      {
        id: 55,
        body: `${commentMarker}\nOld failures`,
        user: { login: "github-actions[bot]", type: "Bot" },
      },
    ],
    artifacts: [
      { id: 88, name: "visual-comparison-2", expired: false },
      { id: 89, name: "visual-pr-report-2", expired: false },
    ],
    existingBranch: false,
    conflict: false,
  };

  const writes: { method: string; route: string; body: string }[] = [];

  const transport = vi.fn<typeof fetch>(async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();

    if (url.startsWith("https://raw.githubusercontent.com/")) {
      return new Response(png, { headers: { "content-type": "image/png" } });
    }

    const route = url.split(`/repos/${repository}/`)[1];
    const method = init?.method ?? "GET";

    if (method !== "GET")
      writes.push({ method, route, body: await new Response(init?.body).text() });
    let data;

    if (route === "actions/runs/10") data = state.run;
    else if (route.startsWith("pulls?")) data = [state.pull];
    else if (route === "pulls/99") data = state.pull;
    else if (route.startsWith("actions/workflows/"))
      data = { workflow_runs: state.newer ? [{ ...run, id: 11 }] : [run] };
    else if (route === "actions/runs/10/artifacts?per_page=100")
      data = { artifacts: state.artifacts };
    else if (route.startsWith("issues/99/comments?")) data = state.comments;
    else if (route === "") data = { private: false };
    else if (route === "git/ref/heads/visual-regression-reports") {
      if (!state.existingBranch) return new Response(null, { status: 404 });
      data = { object: { sha: "parent" } };
    } else if (route === "git/commits/parent") data = { tree: { sha: "base-tree" } };
    else if (route === "git/blobs") data = { sha: "blob-sha" };
    else if (route === "git/trees") data = { sha: "tree-sha" };
    else if (route === "git/commits") data = { sha: "commit-sha" };
    else if (route.startsWith("git/refs")) {
      if (state.conflict) {
        state.conflict = false;
        state.existingBranch = true;

        return new Response(null, { status: 422 });
      }

      data = {};
    } else if (method !== "GET" && route.startsWith("issues/")) data = {};
    else throw new Error(`Unexpected API route ${method} ${route}`);

    return Response.json(data);
  });

  const api = githubClient(repository, "secret-write-token", transport);
  const options = { repository, runId: 10, attempt: 2, directory: "" };

  return { state, writes, transport, api, options };
}

describe("failed visual comparison export", () => {
  it("exports only failed images with project and test labels", async () => {
    const directory = await fixture();
    const reporter = new VisualReporter({ outputDir: directory });
    reporter.onBegin({ metadata: { reference: "main", candidate: head } });

    for (const status of ["passed", "failed", "skipped", "timedOut"] as const) {
      reporter.onTestEnd(
        {
          parent: { project: () => ({ name: "chromium-desktop" }) },
          titlePath: () => ["screens.spec.ts", "en", status],
        },
        {
          status,
          errors: [],
          attachments: [
            {
              name: "origin-main",
              contentType: "image/png",
              path: path.join(directory, "1-before.png"),
            },
          ],
        },
      );
    }

    await reporter.onExit();
    const loaded = await loadReport(path.join(directory, "github-report"));
    expect(loaded.report).toMatchObject({
      total: 4,
      passed: 1,
      failures: [
        {
          project: "chromium-desktop",
          test: "en / failed",
          status: "failed",
          before: "1-before.png",
        },
        { test: "en / timedOut", status: "timedOut", before: "3-before.png" },
      ],
    });
    expect(loaded.images).toHaveLength(2);
    expect(await readFile(path.join(directory, "github-report/1-before.png"))).toEqual(png);
  });
});

describe("untrusted visual report data", () => {
  it.each(["../outside.png", "/tmp/outside.png", "https://evil.test/x.png", "1-before.svg"])(
    "rejects unsafe image path %s",
    async (before) => {
      const data = report();
      data.failures[0].before = before;
      await expect(loadReport(await fixture(data))).rejects.toThrow("Invalid image path");
    },
  );
  it("rejects symlinks and non-PNG files", async () => {
    const directory = await fixture();
    const image = path.join(directory, "1-before.png");
    await rm(image);
    await symlink(path.join(directory, "1-after.png"), image);
    await expect(loadReport(directory)).rejects.toThrow("Invalid report file");
    await rm(image);
    await writeFile(image, "<script>evil()</script>");
    await expect(loadReport(directory)).rejects.toThrow("not PNG");
  });
  it("rejects invalid counts and passed entries in the failure list", async () => {
    await expect(loadReport(await fixture({ ...report(), total: 0 }))).rejects.toThrow(
      "Invalid visual report",
    );
    const data = report();
    data.failures[0].status = "passed";
    await expect(loadReport(await fixture(data))).rejects.toThrow("Invalid failed comparison");
  });
});

describe("PR comment format", () => {
  it("uses collapsible before/after tables, diff, and report/run links", () => {
    const data = report();
    data.failures[0].test = "es / <details> | @everyone\n![bad](https://evil.test)";

    const body = renderComment(
      {
        runURL: "https://github.com/run",
        reportURL: "https://github.com/artifact",
        attempt: 2,
        head,
        images: new Map([
          ["1-before.png", "https://raw.githubusercontent.com/before.png"],
          ["1-after.png", "https://raw.githubusercontent.com/after.png"],
          ["1-diff.png", "https://raw.githubusercontent.com/diff.png"],
        ]),
      },
      data,
    );

    expect(body).toContain("<details>\n<summary>webkit-mobile");
    expect(body).toContain("| Baseline — before | PR — after |");
    expect(body).toContain("![Baseline before](https://raw.githubusercontent.com/before.png)");
    expect(body).toContain("![PR after](https://raw.githubusercontent.com/after.png)");
    expect(body).toContain("![Pixel differences](https://raw.githubusercontent.com/diff.png)");
    expect(body).toContain("[Full report (download)](https://github.com/artifact)");
    expect(body).not.toContain("@everyone");
    expect(body).not.toContain("![bad]");
  });
  it("labels missing screenshots without broken images", () => {
    expect(renderComment({ runURL: "run", attempt: 1, head }, report())).toContain(
      "| No image captured | No image captured |",
    );
  });
});

describe("GitHub publication and updates", () => {
  it("publishes PNGs to an orphan data branch, verifies public bytes, and updates the bot comment for a fork", async () => {
    const { api, options, transport, writes } = server();
    options.directory = await fixture();
    await publishPRReport(api, options, transport);
    expect(writes.find((write) => write.route === "git/commits")?.body).toContain('"parents":[]');
    expect(writes.find((write) => write.route === "git/trees")?.body).not.toContain(".github");
    const comment = writes.find((write) => write.route === "issues/comments/55");
    expect(comment?.method).toBe("PATCH");
    expect(comment?.body).toContain(
      "raw.githubusercontent.com/HorusGoul/trizum/commit-sha/images/blob-sha.png",
    );
    expect(comment?.body).not.toContain("secret-write-token");

    const publicRequests = transport.mock.calls.filter(([input]) =>
      (input instanceof Request ? input.url : input.toString()).startsWith("https://raw."),
    );

    expect(publicRequests.every(([, init]) => init === undefined)).toBe(true);
    expect(
      transport.mock.calls.filter(([input]) =>
        (input instanceof Request ? input.url : input.toString()).startsWith("https://raw."),
      ).length,
    ).toBe(3);
  });
  it("creates the first identifiable comment", async () => {
    const { api, options, transport, writes, state } = server();
    state.comments = [];
    options.directory = await fixture();
    await publishPRReport(api, options, transport);
    expect(writes.at(-1)).toMatchObject({ method: "POST", route: "issues/99/comments" });
  });
  it("clears prior failures after a verified passing run without publishing images", async () => {
    const { api, options, transport, writes, state } = server();
    state.run.conclusion = "success";
    options.directory = await fixture({ ...report(), passed: 2, failures: [] });
    await publishPRReport(api, options, transport);
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toContain("All 2 visual comparisons passed");
    expect(writes[0].body).not.toContain("<details>");
  });
  it.each(["cancelled", "timed_out"])(
    "clears old images after %s without claiming success",
    async (conclusion) => {
      const { api, options, transport, writes, state } = server();
      state.run.conclusion = conclusion;
      state.artifacts = [];
      await publishPRReport(api, options, transport);
      expect(writes.at(-1)?.body).toContain("does not establish visual parity");
    },
  );
  it("updates stale failures with a publication error when this attempt has no artifact", async () => {
    const { api, options, transport, writes, state } = server();
    state.artifacts = [{ id: 80, name: "visual-pr-report-1", expired: false }];
    await expect(publishPRReport(api, options, transport)).rejects.toThrow("publication failed");
    expect(writes.at(-1)?.body).toContain("publication failed");
    expect(writes.at(-1)?.body).not.toContain("<details>");
  });
  it("does not post a passing claim for a failed run with no failed screenshots", async () => {
    const { api, options, transport, writes } = server();
    options.directory = await fixture({ ...report(), passed: 2, failures: [] });
    await publishPRReport(api, options, transport);
    expect(writes.at(-1)?.body).toContain("did not complete a passing");
  });
  it.each(["push", "attempt", "newer run", "dispatch", "repository"])(
    "skips stale or unrelated reports: %s",
    async (reason) => {
      const { api, options, transport, writes, state } = server();

      if (reason === "push") state.pull.head.sha = "c".repeat(40);

      if (reason === "attempt") options.attempt = 1;

      if (reason === "newer run") state.newer = true;

      if (reason === "dispatch") state.run.event = "workflow_dispatch";

      if (reason === "repository") state.pull.head.repo = { ...state.pull.head.repo, id: 999 };
      await publishPRReport(api, options, transport);
      expect(writes).toEqual([]);
    },
  );
  it("does not execute or trust a manifest with a different candidate SHA", async () => {
    const { api, options, transport, writes } = server();
    options.directory = await fixture({ ...report(), candidate: "wrong" });
    await expect(publishPRReport(api, options, transport)).rejects.toThrow("publication failed");
    expect(writes).toHaveLength(1);
  });
  it("retries a concurrent branch creation with a non-forced update and preserves its tree", async () => {
    const { api, state, writes } = server();
    state.conflict = true;
    await publishImages(api, repository, [{ name: "1-before.png", bytes: png }]);
    expect(writes.at(-1)).toMatchObject({
      method: "PATCH",
      route: "git/refs/heads/visual-regression-reports",
    });
    expect(writes.at(-1)?.body).toContain('"force":false');
    expect(writes.filter((write) => write.route === "git/trees").at(-1)?.body).toContain(
      '"base_tree":"base-tree"',
    );
  });
  it("removes duplicate bot reports and leaves human marker lookalikes alone", async () => {
    const { api, state, writes } = server();
    state.comments.push({ ...state.comments[0], id: 56 });
    state.comments.push({ ...state.comments[0], id: 57, user: { login: "human", type: "User" } });
    await upsertComment(api, 99, `${commentMarker}\nnew`);
    expect(writes.map(({ method, route }) => [method, route])).toEqual([
      ["PATCH", "issues/comments/55"],
      ["DELETE", "issues/comments/56"],
    ]);
  });
  it("refuses to claim images are public when the raw server is inaccessible", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error("network unavailable"));
    await expect(
      verifyImages(
        [{ name: "1-before.png", bytes: png, url: "https://raw.githubusercontent.com/image.png" }],
        transport,
      ),
    ).rejects.toThrow("network unavailable");
    expect(transport.mock.calls[0][1]).toBeUndefined();
  });
});
