import { z } from "zod";
import {
  getTextFormatter,
  type LogLevel,
  type LogRecord,
  type Sink,
  type TextFormatter,
} from "@logtape/logtape";

export type GitHubActionsAnnotationCommand = "debug" | "notice" | "warning" | "error";

export interface GitHubActionsAnnotationSinkOptions {
  enabled?: boolean;
  formatter?: TextFormatter;
  levels?: Partial<Record<LogLevel, GitHubActionsAnnotationCommand | null>>;
  writeCommand?: (command: string) => void;
}

interface GitHubActionsProcess {
  env?: Record<string, string | undefined>;
  stdout?: {
    write(chunk: string): void;
  };
}

const DEFAULT_GITHUB_ACTIONS_ANNOTATION_LEVELS = {
  trace: null,
  debug: null,
  info: null,
  warning: null,
  error: "error",
  fatal: "error",
} satisfies Record<LogLevel, GitHubActionsAnnotationCommand | null>;

const defaultGitHubActionsAnnotationBaseFormatter = getTextFormatter({
  timestamp: "none",
  category: ".",
  format({ category, message }) {
    return category === "" ? message : `${category}: ${message}`;
  },
});

function getGitHubActionsProcess(): GitHubActionsProcess | undefined {
  // SAFETY: Node and the test harness provide process; browser runtimes may omit it, so every use checks optional capabilities.
  return (globalThis as typeof globalThis & { process?: GitHubActionsProcess }).process;
}

function isGitHubActionsEnvironment(): boolean {
  return getGitHubActionsProcess()?.env?.GITHUB_ACTIONS === "true";
}

function escapeGitHubActionsCommandValue(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function getGitHubActionsErrorSummary(cause: unknown): string | null {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }

  const primitive = annotationErrorSummarySchema.safeParse(cause);

  if (primitive.success) return String(primitive.data);

  return null;
}

const defaultGitHubActionsAnnotationFormatter: TextFormatter = (record: LogRecord): string => {
  const message = defaultGitHubActionsAnnotationBaseFormatter(record).replace(/[\r\n]+$/u, "");
  const errorSummary = getGitHubActionsErrorSummary(record.properties.error);

  if (errorSummary == null || message.includes(errorSummary)) {
    return message;
  }

  return `${message} (${errorSummary})`;
};

function defaultWriteGitHubActionsCommand(command: string): void {
  getGitHubActionsProcess()?.stdout?.write(command);
}

export function getGitHubActionsAnnotationSink({
  enabled = isGitHubActionsEnvironment(),
  formatter = defaultGitHubActionsAnnotationFormatter,
  levels,
  writeCommand = defaultWriteGitHubActionsCommand,
}: GitHubActionsAnnotationSinkOptions = {}): Sink {
  const resolvedLevels = {
    ...DEFAULT_GITHUB_ACTIONS_ANNOTATION_LEVELS,
    ...(levels ?? {}),
  } satisfies Record<LogLevel, GitHubActionsAnnotationCommand | null>;

  return (record) => {
    if (!enabled) {
      return;
    }

    const annotationCommand = resolvedLevels[record.level];

    if (annotationCommand == null) {
      return;
    }

    const message = formatter(record).replace(/[\r\n]+$/u, "");
    writeCommand(`::${annotationCommand}::${escapeGitHubActionsCommandValue(message)}\n`);
  };
}

const annotationErrorSummarySchema = z.union([
  z.string(),
  z.number(),
  z.nan(),
  z.literal(Infinity),
  z.literal(-Infinity),
  z.boolean(),
  z.bigint(),
]);
