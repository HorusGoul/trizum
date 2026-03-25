import {
  configureSync,
  getConfig,
  getConsoleSink,
  getLogger,
  getTextFormatter,
  type ContextLocalStorage,
  type LogLevel,
  type Logger,
  type LoggerConfig,
  type LogRecord,
  type Sink,
  type TextFormatter,
} from "@logtape/logtape";

export type TrizumSurface = string;
export type TrizumCategory<TSurface extends string = TrizumSurface> = [
  "trizum",
  TSurface,
  ...string[],
];
export type TrizumSinkId<TSinkId extends string = never> = "console" | TSinkId;
export type TrizumLoggerConfig<TSinkId extends string = never> = LoggerConfig<
  TrizumSinkId<TSinkId>,
  never
>;

export type GitHubActionsAnnotationCommand =
  | "debug"
  | "notice"
  | "warning"
  | "error";

export interface ConfigureTrizumLoggingOptions<TSinkId extends string = never> {
  surface: TrizumSurface;
  lowestLevel?: LogLevel | null;
  extraSinks?: Record<TSinkId, Sink>;
  extraLoggers?: TrizumLoggerConfig<TSinkId>[];
  surfaceSinks?: readonly TrizumSinkId<TSinkId>[];
  contextLocalStorage?: ContextLocalStorage<Record<string, unknown>>;
  metaLowestLevel?: LogLevel | null;
  reset?: boolean;
}

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

export function getTrizumCategory<TSurface extends string>(
  surface: TSurface,
  ...scope: string[]
): TrizumCategory<TSurface> {
  return ["trizum", surface, ...scope];
}

export function getTrizumLogger<TSurface extends string>(
  surface: TSurface,
  ...scope: string[]
): Logger {
  return getLogger(getTrizumCategory(surface, ...scope));
}

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

export function configureTrizumLogging<TSinkId extends string = never>({
  surface,
  lowestLevel = "info",
  extraSinks,
  extraLoggers = [],
  surfaceSinks = ["console"],
  contextLocalStorage,
  metaLowestLevel = "warning",
  reset = false,
}: ConfigureTrizumLoggingOptions<TSinkId>): void {
  if (getConfig() != null && !reset) {
    return;
  }

  const sinks = {
    console: getConsoleSink() as Sink,
    ...(extraSinks ?? {}),
  } as Record<TrizumSinkId<TSinkId>, Sink>;

  configureSync({
    sinks,
    loggers: [
      ...extraLoggers,
      {
        category: getTrizumCategory(surface),
        lowestLevel,
        sinks: [...surfaceSinks],
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: metaLowestLevel,
        parentSinks: "override",
        sinks: ["console"],
      },
    ],
    contextLocalStorage,
    reset,
  });
}
