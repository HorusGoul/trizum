import {
  getTextFormatter,
  type LogLevel,
  type LogRecord,
  type Sink,
  type TextFormatter,
} from "@logtape/logtape";

export type GitHubActionsAnnotationCommand =
  | "debug"
  | "notice"
  | "warning"
  | "error";

export interface GitHubActionsAnnotationSinkOptions {
  enabled?: boolean;
  formatter?: TextFormatter;
  levels?: Partial<Record<LogLevel, GitHubActionsAnnotationCommand | null>>;
  writeCommand?: (command: string) => void;
}

interface GitHubActionsProcess {
  env?: Record<string, string | undefined>;
  stdout?: {
    write(chunk: string): unknown;
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
  return (globalThis as typeof globalThis & { process?: GitHubActionsProcess })
    .process;
}

function isGitHubActionsEnvironment(): boolean {
  return getGitHubActionsProcess()?.env?.GITHUB_ACTIONS === "true";
}

function escapeGitHubActionsCommandValue(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function getGitHubActionsErrorSummary(error: unknown): string | null {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (
    typeof error === "string" ||
    typeof error === "number" ||
    typeof error === "boolean" ||
    typeof error === "bigint"
  ) {
    return String(error);
  }

  return null;
}

const defaultGitHubActionsAnnotationFormatter: TextFormatter = (
  record: LogRecord,
): string => {
  const message = defaultGitHubActionsAnnotationBaseFormatter(record);
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

    const message = formatter(record);
    writeCommand(
      `::${annotationCommand}::${escapeGitHubActionsCommandValue(message)}\n`,
    );
  };
}
