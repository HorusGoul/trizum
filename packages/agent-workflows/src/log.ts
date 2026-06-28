import {
  configureTrizumLogging,
  getTrizumLogger,
  type ConfigureTrizumLoggingOptions,
} from "@trizum/logging";

type AgentWorkflowLoggingOptions<TSinkId extends string = never> = Omit<
  ConfigureTrizumLoggingOptions<TSinkId>,
  "surface"
>;

export const rootLogger = getTrizumLogger("agent-workflows");

export function getLogger(...scope: string[]) {
  return getTrizumLogger("agent-workflows", ...scope);
}

export function configureAgentWorkflowLogging<TSinkId extends string = never>(
  options: AgentWorkflowLoggingOptions<TSinkId> = {},
): void {
  configureTrizumLogging({
    surface: "agent-workflows",
    ...options,
  });
}
