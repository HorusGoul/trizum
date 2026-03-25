import {
  configureTrizumLogging,
  getTrizumLogger,
  type ConfigureTrizumLoggingOptions,
} from "@trizum/logging";
import { getGitHubActionsAnnotationSink } from "@trizum/logging/github-actions";

const GITHUB_ACTIONS_ANNOTATION_SINK_ID = "githubActionsAnnotations";

type ScreenshotsBuiltInSinkId = typeof GITHUB_ACTIONS_ANNOTATION_SINK_ID;
type ScreenshotsLoggingOptions<TSinkId extends string = never> = Omit<
  ConfigureTrizumLoggingOptions<ScreenshotsBuiltInSinkId | TSinkId>,
  "surface"
>;

export const rootLogger = getTrizumLogger("screenshots");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("screenshots", ...scope);
}

export function configureScreenshotsLogging<TSinkId extends string = never>(
  options: ScreenshotsLoggingOptions<TSinkId> = {},
): void {
  const { extraSinks, surfaceSinks, ...rest } = options;

  configureTrizumLogging({
    surface: "screenshots",
    ...rest,
    extraSinks: {
      [GITHUB_ACTIONS_ANNOTATION_SINK_ID]: getGitHubActionsAnnotationSink(),
      ...(extraSinks ?? {}),
    } as NonNullable<
      ConfigureTrizumLoggingOptions<
        ScreenshotsBuiltInSinkId | TSinkId
      >["extraSinks"]
    >,
    surfaceSinks: Array.from(
      new Set([
        ...(surfaceSinks ?? ["console"]),
        GITHUB_ACTIONS_ANNOTATION_SINK_ID,
      ]),
    ) as (ScreenshotsBuiltInSinkId | TSinkId | "console")[],
  });
}
