import {
  configureTrizumLogging,
  getTrizumLogger,
  type ConfigureTrizumLoggingOptions,
} from "@trizum/logging";

type MobileLoggingOptions<TSinkId extends string = never> = Omit<
  ConfigureTrizumLoggingOptions<TSinkId>,
  "surface"
>;

export const rootLogger = getTrizumLogger("mobile");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("mobile", ...scope);
}

export function configureMobileLogging<TSinkId extends string = never>(
  options: MobileLoggingOptions<TSinkId> = {},
): void {
  configureTrizumLogging({
    surface: "mobile",
    ...options,
  });
}
