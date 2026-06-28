import { spawn } from "node:child_process";

export interface RunCommandOptions {
  allowFailure?: boolean;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  envMode?: "merge" | "replace";
  input?: string;
  timeoutMs?: number;
}

export interface CommandResult {
  command: string;
  exitCode: number;
  stderr: string;
  stdout: string;
}

export class CommandFailedError extends Error {
  readonly result: CommandResult;

  constructor(result: CommandResult) {
    super(
      [`Command failed with exit code ${result.exitCode}: ${result.command}`, result.stderr.trim()]
        .filter(Boolean)
        .join("\n"),
    );
    this.name = "CommandFailedError";
    this.result = result;
  }
}

export async function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions,
): Promise<CommandResult> {
  const displayCommand = [command, ...args].join(" ");

  const result = await new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: resolveCommandEnvironment(options),
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let timeout: NodeJS.Timeout | undefined;

    if (options.timeoutMs != null) {
      timeout = setTimeout(() => {
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on("error", (error) => {
      if (timeout != null) {
        clearTimeout(timeout);
      }
      reject(error);
    });

    child.on("close", (code, signal) => {
      if (timeout != null) {
        clearTimeout(timeout);
      }

      const exitCode = code ?? (signal == null ? 1 : 128);
      resolve({
        command: displayCommand,
        exitCode,
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      });
    });

    if (options.input != null) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });

  if (result.exitCode !== 0 && options.allowFailure !== true) {
    throw new CommandFailedError(result);
  }

  return result;
}

export function createSecretScrubEnvironmentOverrides(
  options: { preserveCodexHome?: boolean } = {},
): NodeJS.ProcessEnv {
  const overrides: NodeJS.ProcessEnv = {};

  for (const key of Object.keys(process.env)) {
    if (shouldScrubEnvironmentKey(key, options)) {
      overrides[key] = "";
    }
  }

  for (const key of credentialEnvironmentKeys(options)) {
    overrides[key] = "";
  }

  return overrides;
}

export function createSanitizedEnvironment(
  options: { preserveCodexHome?: boolean } = {},
): NodeJS.ProcessEnv {
  const environment = { ...process.env };

  for (const key of Object.keys(environment)) {
    if (shouldScrubEnvironmentKey(key, options)) {
      delete environment[key];
    }
  }

  return environment;
}

export function redactSecrets(text: string): string {
  let redacted = text;

  for (const key of credentialEnvironmentKeys({ preserveCodexHome: true })) {
    const value = process.env[key];
    if (value != null && value.length >= 8) {
      redacted = redacted.replaceAll(value, "[redacted]");
    }
  }

  return redacted
    .replace(/github_pat_[A-Za-z0-9_]{20,}/g, "[redacted]")
    .replace(/gh[opsu]_[A-Za-z0-9_]{20,}/g, "[redacted]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted]")
    .replace(/"((?:access|refresh|id)_token|token)"\s*:\s*"[^"]+"/gi, '"$1":"[redacted]"');
}

function resolveCommandEnvironment(options: RunCommandOptions): NodeJS.ProcessEnv {
  if (options.envMode === "replace") {
    return options.env ?? {};
  }

  return {
    ...process.env,
    ...options.env,
  };
}

function credentialEnvironmentKeys(options: { preserveCodexHome?: boolean }): string[] {
  return [
    "BOT_GITHUB_TOKEN",
    "BW_ACCESS_TOKEN",
    "BWS_ACCESS_TOKEN",
    "CODEX_ACCESS_TOKEN",
    "CODEX_AUTH_JSON",
    ...(options.preserveCodexHome === true ? [] : ["CODEX_HOME"]),
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "OPENAI_API_KEY",
    "TRIZUM_AGENT_WORKFLOWS_GIT_PUSH_TOKEN",
    "TRIZUM_AGENT_WORKFLOWS_GITHUB_TOKEN",
  ];
}

function shouldScrubEnvironmentKey(key: string, options: { preserveCodexHome?: boolean }): boolean {
  if (credentialEnvironmentKeys(options).includes(key)) {
    return true;
  }

  return (
    key.startsWith("ACTIONS_ID_TOKEN_") ||
    key.startsWith("BITWARDEN_") ||
    key.startsWith("BWS_") ||
    key.startsWith("BW_")
  );
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n[truncated ${text.length - maxLength} bytes]`;
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
}
