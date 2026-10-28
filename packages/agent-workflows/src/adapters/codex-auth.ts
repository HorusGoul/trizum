import type { AgentProvider } from "@ai-hero/sandcastle";
import { z } from "zod";

const failureEventSchema = z.union([
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("turn.failed"), error: z.object({ message: z.string() }) }),
]);

export function trackCodexAuthentication(agent: AgentProvider): AgentProvider & {
  throwIfAuthenticationFailed(error: unknown): void;
} {
  let authenticationError: string | undefined;
  return {
    ...agent,
    parseStreamLine(line) {
      // Sandcastle otherwise discards stdout errors whenever stderr is nonempty.
      authenticationError ??= authenticationErrorFromEvent(line);
      return agent.parseStreamLine(line);
    },
    throwIfAuthenticationFailed(error) {
      throwIfCodexAuthenticationFailed(authenticationError ?? error);
    },
  };
}

function authenticationErrorFromEvent(line: string): string | undefined {
  let event: z.infer<typeof failureEventSchema>;
  try {
    const parsed = failureEventSchema.safeParse(JSON.parse(line));
    if (!parsed.success) return undefined;
    event = parsed.data;
  } catch {
    return undefined;
  }
  const message = event.type === "error" ? event.message : event.error.message;
  return isAuthenticationError(message) ? message : undefined;
}

function isAuthenticationError(message: string): boolean {
  return /invalid_refresh_token|refresh_token_(?:reused|expired|invalidated)|Your access token could not be refreshed|Could not parse your authentication token/i.test(
    message,
  );
}

function throwIfCodexAuthenticationFailed(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (isAuthenticationError(message)) {
    throw new Error(
      "CI login needs renewal. Run `vp run codex:auth`, replace the Bitwarden secret referenced by BITWARDEN_CODEX_AUTH_JSON_SECRET_ID, then rerun the workflow. Codex authentication failed; no further agent operations will be attempted.",
    );
  }
}
