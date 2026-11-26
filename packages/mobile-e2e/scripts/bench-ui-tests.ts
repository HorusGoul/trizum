/**
 * Benchmarks the Maestro flows in `.maestro/` against the e2e tests in `e2e/`
 * on one device. Both suites cover the same three journeys and run against the
 * already-installed app, alternating which runner goes first in each round.
 *
 * Usage (from packages/mobile-e2e):
 *   node scripts/bench-ui-tests.ts --platform ios --device <udid> --runs 5
 *   node scripts/bench-ui-tests.ts --platform android --device <serial> --runs 5
 *
 * Pass --app-id <id> to test a renamed build instead of app.trizum.capacitor.
 *
 * By default every run starts cold: the agent-device daemon that e2e leaves
 * running (with its device runner) is stopped before each run, untimed, the
 * same way Maestro starts its driver on every run. Pass --warm-e2e to keep the
 * daemon between e2e runs instead.
 *
 * Writes `bench-results/<platform>-<timestamp>/summary.{json,md}`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";

type Runner = "maestro" | "e2e";

interface RunResult {
  runner: Runner;
  round: number;
  wallMs: number;
  passed: boolean;
  tests: Record<string, number>;
}

const { values } = parseArgs({
  options: {
    platform: { type: "string" },
    device: { type: "string" },
    runs: { type: "string", default: "5" },
    "app-id": { type: "string" },
    "warm-e2e": { type: "boolean", default: false },
  },
});

const platform = values.platform;
const device = values.device;
const runs = Number(values.runs);
const appId = values["app-id"];
const warmE2E = values["warm-e2e"];

if ((platform !== "ios" && platform !== "android") || !device || !Number.isInteger(runs)) {
  process.stderr.write(
    "Usage: node scripts/bench-ui-tests.ts --platform ios|android --device <id> --runs <n> [--app-id <id>] [--warm-e2e]\n",
  );
  process.exit(2);
}

const packageDir = path.resolve(import.meta.dirname, "..");

const outDir = path.join(
  packageDir,
  "bench-results",
  `${platform}-${new Date().toISOString().replaceAll(":", "-")}`,
);

mkdirSync(outDir, { recursive: true });

// The suites share test titles; key both by the lowercased title.
function testKey(title: string) {
  return title
    .replace(/^.* > /, "")
    .replace(/ \[(ios|android)\]$/, "")
    .toLowerCase();
}

function runMaestro(round: number): RunResult {
  const debugDir = path.join(outDir, `maestro-${round}`);
  const started = performance.now();

  const result = spawnSync(
    "maestro",
    [
      "--device",
      device!,
      "test",
      ".maestro",
      "--debug-output",
      debugDir,
      "--flatten-debug-output",
      ...(appId ? ["-e", `APP_ID=${appId}`] : []),
    ],
    {
      cwd: packageDir,
      env: {
        ...process.env,
        MAESTRO_CLI_NO_ANALYTICS: "1",
        MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
      },
      encoding: "utf8",
    },
  );

  const wallMs = performance.now() - started;
  writeFileSync(path.join(debugDir, "stdout.log"), `${result.stdout}\n${result.stderr}`);

  // Each flow's commands file lists start timestamps and durations in ms.
  const tests: Record<string, number> = {};

  for (const file of readdirSync(debugDir)) {
    const match = /^commands-\((.+)\)\.json$/.exec(file);

    if (!match) continue;

    // SAFETY: Maestro writes this file as an array of commands whose optional
    // metadata holds numeric timestamp and duration fields; missing ones are skipped.
    const commands = JSON.parse(readFileSync(path.join(debugDir, file), "utf8")) as {
      metadata?: { timestamp?: number; duration?: number };
    }[];

    const starts: number[] = [];
    const ends: number[] = [];

    for (const { metadata } of commands) {
      if (metadata?.timestamp === undefined) continue;

      starts.push(metadata.timestamp);
      ends.push(metadata.timestamp + (metadata.duration ?? 0));
    }

    tests[testKey(match[1]!)] = Math.max(...ends) - Math.min(...starts);
  }

  return { runner: "maestro", round, wallMs, passed: result.status === 0, tests };
}

function runE2E(round: number): RunResult {
  const outputDir = path.join(outDir, `e2e-${round}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2E_TELEMETRY_DISABLED: "1",
    [platform === "ios" ? "E2E_IOS_DEVICE" : "E2E_ANDROID_DEVICE"]: device,
  };

  if (appId) env.E2E_APP_ID = appId;

  const started = performance.now();

  const result = spawnSync(
    "vp",
    [
      "exec",
      "e2e",
      "run",
      "--target",
      platform!,
      "--reporter",
      "list,junit",
      "--output",
      outputDir,
    ],
    {
      cwd: packageDir,
      env,
      encoding: "utf8",
    },
  );

  const wallMs = performance.now() - started;
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "stdout.log"), `${result.stdout}\n${result.stderr}`);

  const tests: Record<string, number> = {};

  try {
    const junit = readFileSync(path.join(outputDir, "junit.xml"), "utf8");

    for (const match of junit.matchAll(/<testcase name="([^"]+)"[^>]* time="([\d.]+)"/g)) {
      const title = match[1]!.replaceAll("&gt;", ">").replaceAll("&amp;", "&");
      tests[testKey(title)] = Number(match[2]) * 1000;
    }
  } catch {
    // A run that failed before writing junit.xml keeps an empty test map.
  }

  return { runner: "e2e", round, wallMs, passed: result.status === 0, tests };
}

// Stops the agent-device daemon e2e started, with its device runner, so the
// next run starts cold and Maestro's driver has the device to itself.
function stopAgentDevice() {
  spawnSync("vp", ["exec", "agent-device", "daemon", "stop", "--clean"], {
    cwd: packageDir,
    encoding: "utf8",
  });
}

const results: RunResult[] = [];

for (let round = 0; round < runs; round++) {
  const order: Runner[] = round % 2 === 0 ? ["maestro", "e2e"] : ["e2e", "maestro"];

  for (const runner of order) {
    if (!warmE2E) stopAgentDevice();

    const result = runner === "maestro" ? runMaestro(round) : runE2E(round);
    results.push(result);
    process.stdout.write(
      `round ${round + 1}/${runs} ${runner}: ${(result.wallMs / 1000).toFixed(1)}s ${result.passed ? "passed" : "FAILED"}\n`,
    );
  }
}

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;

  return {
    n: sorted.length,
    median,
    mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    min: sorted[0]!,
    max: sorted.at(-1)!,
  };
}

const runners: Runner[] = ["maestro", "e2e"];
const testKeys = [...new Set(results.flatMap((result) => Object.keys(result.tests)))].sort();

const summary = {
  platform,
  device,
  runs,
  warmE2E,
  passRate: Object.fromEntries(
    runners.map((runner) => {
      const own = results.filter((result) => result.runner === runner);

      return [runner, `${own.filter((result) => result.passed).length}/${own.length}`];
    }),
  ),
  wall: Object.fromEntries(
    runners.map((runner) => [
      runner,
      stats(
        results.flatMap((result) =>
          result.runner === runner && result.passed ? [result.wallMs] : [],
        ),
      ),
    ]),
  ),
  tests: Object.fromEntries(
    testKeys.map((key) => [
      key,
      Object.fromEntries(
        runners.map((runner) => [
          runner,
          stats(
            results.flatMap((result) => {
              const duration = result.tests[key];

              return result.runner === runner && duration !== undefined ? [duration] : [];
            }),
          ),
        ]),
      ),
    ]),
  ),
  results,
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const row = (label: string, maestro: ReturnType<typeof stats>, e2e: ReturnType<typeof stats>) =>
  `| ${label} | ${seconds(maestro.median)} (${seconds(maestro.min)}–${seconds(maestro.max)}) | ${seconds(e2e.median)} (${seconds(e2e.min)}–${seconds(e2e.max)}) | ${((1 - e2e.median / maestro.median) * 100).toFixed(0)}% |`;

const markdown = [
  `## ${platform} · ${device} · ${runs} rounds · ${warmE2E ? "warm" : "cold"} e2e daemon`,
  "",
  `Pass rate: Maestro ${summary.passRate.maestro}, e2e ${summary.passRate.e2e}`,
  "",
  "| | Maestro median (min–max) | e2e median (min–max) | e2e faster by |",
  "| --- | --- | --- | --- |",
  row("Whole suite, wall clock", summary.wall.maestro!, summary.wall.e2e!),
  ...testKeys.map((key) => row(key, summary.tests[key]!.maestro!, summary.tests[key]!.e2e!)),
  "",
].join("\n");

writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

writeFileSync(path.join(outDir, "summary.md"), markdown);

process.stdout.write(`\n${markdown}\nResults: ${outDir}\n`);
