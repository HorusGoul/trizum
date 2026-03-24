import {
  configureTrizumLogging,
  getTrizumLogger,
  type ConfigureTrizumLoggingOptions,
} from "@trizum/logging";

type ScreenshotsLoggingOptions<TSinkId extends string = never> = Omit<
  ConfigureTrizumLoggingOptions<TSinkId>,
  "surface"
>;

export const rootLogger = getTrizumLogger("screenshots");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("screenshots", ...scope);
}

export function configureScreenshotsLogging<TSinkId extends string = never>(
  options: ScreenshotsLoggingOptions<TSinkId> = {},
): void {
  configureTrizumLogging({
    surface: "screenshots",
    ...options,
  });
}
