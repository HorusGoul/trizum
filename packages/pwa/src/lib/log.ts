import {
  configureTrizumLogging,
  getTrizumLogger,
  type ConfigureTrizumLoggingOptions,
} from "@trizum/logging";

type PwaLoggingOptions<TSinkId extends string = never> = Omit<
  ConfigureTrizumLoggingOptions<TSinkId>,
  "app"
>;

export const rootLogger = getTrizumLogger("pwa");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("pwa", ...scope);
}

export function configurePwaLogging<TSinkId extends string = never>(
  options: PwaLoggingOptions<TSinkId> = {},
): void {
  configureTrizumLogging({
    app: "pwa",
    ...options,
  });
}
