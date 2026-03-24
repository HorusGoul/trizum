import {
  configureTrizumLogging,
  getTrizumLogger,
  type ConfigureTrizumLoggingOptions,
} from "@trizum/logging";

type TemplateLoggingOptions<TSinkId extends string = never> = Omit<
  ConfigureTrizumLoggingOptions<TSinkId>,
  "surface"
>;

export const rootLogger = getTrizumLogger("ts-template");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("ts-template", ...scope);
}

export function configureTemplateLogging<TSinkId extends string = never>(
  options: TemplateLoggingOptions<TSinkId> = {},
): void {
  configureTrizumLogging({
    surface: "ts-template",
    ...options,
  });
}
