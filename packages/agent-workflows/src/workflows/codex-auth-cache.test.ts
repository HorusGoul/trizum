/// <reference types="node" />
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";

const workflow = await readFile(
  new URL("../../../../.github/workflows/renovate-agent-review.yml", import.meta.url),
  "utf8",
);
const original = {
  auth_mode: "chatgpt",
  tokens: { access_token: "test-access", refresh_token: "test-refresh" },
};
let directory: string;
let environment: NodeJS.ProcessEnv;

function step(name: string): string {
  const contents = workflow.split(`      - name: ${name}\n`)[1]?.split("      - name:")[0];
  if (contents == null) throw new Error(`Missing workflow step: ${name}`);
  return contents;
}

function runStep(name: string) {
  const script = step(name)
    .split("        run: |\n")[1]
    ?.replace(/^          /gm, "");
  if (script == null) throw new Error(`Missing workflow script: ${name}`);
  return spawnSync("bash", ["-c", script], { env: environment, encoding: "utf8" });
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "trizum-auth-test-"));
  environment = {
    PATH: `${directory}:${process.env.PATH}`,
    CODEX_HOME: path.join(directory, "codex"),
    CODEX_AUTH_JSON: JSON.stringify(original),
    GITHUB_ENV: path.join(directory, "github-env"),
    BITWARDEN_CODEX_AUTH_JSON_SECRET_ID: "test-secret-id",
    BWS_ACCESS_TOKEN: "test-machine-token",
    TEST_DIRECTORY: directory,
  };
  // Exercise the actual workflow scripts while replacing only external writes and delays.
  await writeFile(
    path.join(directory, "docker"),
    `#!/bin/bash
set -eu
count=0
if [[ -f "$TEST_DIRECTORY/attempts" ]]; then
  count=$(cat "$TEST_DIRECTORY/attempts")
fi
echo "$((count + 1))" > "$TEST_DIRECTORY/attempts"
if (( count < \${TEST_FAILURES:-0} )); then exit 1; fi
while (( $# )); do
  if [[ "$1" == "--value" ]]; then
    printf '%s' "$2" > "$TEST_DIRECTORY/saved.json"
    exit 0
  fi
  shift
done
exit 1
`,
    { mode: 0o700 },
  );
  await writeFile(path.join(directory, "sleep"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
  if (runStep("Restore Codex auth cache").status !== 0) {
    throw new Error("Could not restore the test auth cache");
  }
});

afterEach(async () => {
  await rm(directory, { force: true, recursive: true });
});

test("saves refreshed credentials after a review failure and retries write failures", async () => {
  expect(step("Save refreshed Codex auth to Bitwarden")).toContain(
    "if: always() && steps.restore_codex_auth.outcome == 'success'",
  );
  const refreshed = { ...original, tokens: { ...original.tokens, refresh_token: "rotated" } };
  await writeFile(path.join(directory, "codex/auth.json"), JSON.stringify(refreshed));
  environment.TEST_FAILURES = "2";

  expect(runStep("Save refreshed Codex auth to Bitwarden").status).toBe(0);
  expect(JSON.parse(await readFile(path.join(directory, "saved.json"), "utf8"))).toEqual(refreshed);
  expect(await readFile(path.join(directory, "attempts"), "utf8")).toBe("3\n");
});

test("does not write unchanged credentials", async () => {
  expect(runStep("Save refreshed Codex auth to Bitwarden").status).toBe(0);
  await expect(readFile(path.join(directory, "attempts"))).rejects.toThrow("ENOENT");
});

test("does not overwrite Bitwarden with an incomplete credential bundle", async () => {
  await writeFile(path.join(directory, "codex/auth.json"), '{"auth_mode":"chatgpt","tokens":{}}');
  expect(runStep("Save refreshed Codex auth to Bitwarden").status).toBe(1);
  await expect(readFile(path.join(directory, "attempts"))).rejects.toThrow("ENOENT");
});

test("fails visibly when all write attempts fail", async () => {
  await writeFile(
    path.join(directory, "codex/auth.json"),
    JSON.stringify({ ...original, last_refresh: "2026-10-28" }),
  );
  environment.TEST_FAILURES = "3";
  const result = runStep("Save refreshed Codex auth to Bitwarden");
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("::error::Could not save refreshed Codex credentials");
  expect(await readFile(path.join(directory, "attempts"), "utf8")).toBe("3\n");
});
