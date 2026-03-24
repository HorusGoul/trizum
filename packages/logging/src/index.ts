import {
  configureSync,
  getConfig,
  getConsoleSink,
  getLogger,
  type ContextLocalStorage,
  type LogLevel,
  type Logger,
  type LoggerConfig,
  type Sink,
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

export interface ConfigureTrizumLoggingOptions<TSinkId extends string = never> {
  surface: TrizumSurface;
  lowestLevel?: LogLevel | null;
  extraSinks?: Record<TSinkId, Sink>;
  extraLoggers?: TrizumLoggerConfig<TSinkId>[];
  contextLocalStorage?: ContextLocalStorage<Record<string, unknown>>;
  metaLowestLevel?: LogLevel | null;
  reset?: boolean;
}

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

export function configureTrizumLogging<TSinkId extends string = never>({
  surface,
  lowestLevel = "info",
  extraSinks,
  extraLoggers = [],
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
        sinks: ["console"],
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
