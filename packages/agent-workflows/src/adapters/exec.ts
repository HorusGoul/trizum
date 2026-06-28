import { spawn } from "node:child_process";

export interface RunCommandOptions {
  allowFailure?: boolean;
  cwd: string;
  env?: NodeJS.ProcessEnv;
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
      env: {
        ...process.env,
        ...options.env,
      },
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
