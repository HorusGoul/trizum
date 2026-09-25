import {
  configureSync,
  getConfig,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  type ContextLocalStorage,
  type LogLevel,
  type Logger,
  type LoggerConfig,
  type Sink,
} from "@logtape/logtape";
import { withDocumentIdRedaction } from "./redaction.js";

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
  consoleFormat?: "default" | "json";
  extraSinks?: Record<TSinkId, Sink>;
  extraLoggers?: TrizumLoggerConfig<TSinkId>[];
  surfaceSinks?: readonly TrizumSinkId<TSinkId>[];
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
  consoleFormat = "default",
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
    console: getConsoleSink({
      formatter: consoleFormat === "json" ? jsonLinesFormatter : undefined,
    }) as Sink,
    ...(extraSinks ?? {}),
  } as Record<TrizumSinkId<TSinkId>, Sink>;

  for (const id of Object.keys(sinks) as TrizumSinkId<TSinkId>[]) {
    sinks[id] = withDocumentIdRedaction(sinks[id]);
  }

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
