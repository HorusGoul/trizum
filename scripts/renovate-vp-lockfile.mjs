#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const vpHome = process.env.VP_HOME ?? join(homedir(), ".vite-plus");
const vpBinDir = join(vpHome, "bin");

function writeStdout(message) {
  process.stdout.write(`${message}\n`);
}

function writeStderr(message) {
  process.stderr.write(`${message}\n`);
}

function prependVpBinToPath() {
  const pathParts = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  if (!pathParts.includes(vpBinDir)) {
    process.env.PATH = [vpBinDir, ...pathParts].join(delimiter);
  }
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    writeStderr(`${formatCommand(command, args)} failed: ${result.error.message}`);
    process.exit(1);
  }

  if (result.signal) {
    writeStderr(`${formatCommand(command, args)} exited with signal ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function commandSucceeds(command, args) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
  });

  return !result.error && result.status === 0;
}

function installVp() {
  writeStdout("vp was not found; installing Vite+.");

  if (process.platform === "win32") {
    run(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://vite.plus/ps1 | iex"],
      {
        env: {
          ...process.env,
          CI: "true",
          VP_NODE_MANAGER: "yes",
        },
      },
    );
    return;
  }

  run("bash", ["-c", "curl -fsSL https://vite.plus | bash"], {
    env: {
      ...process.env,
      CI: "true",
      VP_NODE_MANAGER: "yes",
    },
  });
}

prependVpBinToPath();

if (!commandSucceeds("vp", ["help"])) {
  installVp();
  prependVpBinToPath();
}

if (!commandSucceeds("vp", ["help"])) {
  writeStderr("vp is still unavailable after installation.");
  process.exit(1);
}

run("vp", ["install", "--lockfile-only"]);
