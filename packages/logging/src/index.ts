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

export const TRIZUM_APPS = [
  "server",
  "pwa",
  "mobile",
  "screenshots",
  "ts-template",
] as const;

export type TrizumApp = (typeof TRIZUM_APPS)[number];
export type TrizumCategory = ["trizum", TrizumApp, ...string[]];
export type TrizumSinkId<TSinkId extends string = never> = "console" | TSinkId;
export type TrizumLoggerConfig<TSinkId extends string = never> = LoggerConfig<
  TrizumSinkId<TSinkId>,
  never
>;

export interface ConfigureTrizumLoggingOptions<TSinkId extends string = never> {
  app: TrizumApp;
  lowestLevel?: LogLevel | null;
  extraSinks?: Record<TSinkId, Sink>;
  extraLoggers?: TrizumLoggerConfig<TSinkId>[];
  contextLocalStorage?: ContextLocalStorage<Record<string, unknown>>;
  metaLowestLevel?: LogLevel | null;
  reset?: boolean;
}

export function getTrizumCategory(
  app: TrizumApp,
  ...scope: string[]
): TrizumCategory {
  return ["trizum", app, ...scope];
}

export function getTrizumLogger(app: TrizumApp, ...scope: string[]): Logger {
  return getLogger(getTrizumCategory(app, ...scope));
}

export function configureTrizumLogging<TSinkId extends string = never>({
  app,
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
        category: getTrizumCategory(app),
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
