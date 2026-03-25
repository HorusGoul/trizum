import { afterEach, describe, expect, test, vi } from "vitest";
import {
  configureSync,
  getLogger,
  resetSync,
  type Logger,
} from "@logtape/logtape";
import { getGitHubActionsAnnotationSink } from "@trizum/logging/github-actions";

interface TestProcess {
  env: Record<string, string | undefined>;
  stdout: {
    write(chunk: string): unknown;
  };
}

function getTestProcess(): TestProcess {
  return (globalThis as typeof globalThis & { process: TestProcess }).process;
}

function emitWithSink(
  configureSink: ReturnType<typeof getGitHubActionsAnnotationSink>,
  callback: (logger: Logger) => void,
): void {
  configureSync({
    sinks: {
      githubActions: configureSink,
    },
    loggers: [
      {
        category: ["trizum", "screenshots"],
        lowestLevel: "debug",
        sinks: ["githubActions"],
      },
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        parentSinks: "override",
        sinks: ["githubActions"],
      },
    ],
    reset: true,
  });

  callback(getLogger(["trizum", "screenshots", "capture"]));
}

let originalGitHubActions: string | undefined;

afterEach(() => {
  const processRef = getTestProcess();
  processRef.env.GITHUB_ACTIONS = originalGitHubActions;
  vi.restoreAllMocks();
  resetSync();
});

describe("@trizum/logging/github-actions", () => {
  test("does not emit annotations outside GitHub Actions by default", () => {
    const processRef = getTestProcess();
    originalGitHubActions = processRef.env.GITHUB_ACTIONS;
    processRef.env.GITHUB_ACTIONS = undefined;

    const writeSpy = vi
      .spyOn(processRef.stdout, "write")
      .mockImplementation(() => true);

    emitWithSink(getGitHubActionsAnnotationSink(), (logger) => {
      logger.error("Screenshot capture failed", {
        error: new Error("Boom"),
      });
    });

    expect(writeSpy).not.toHaveBeenCalled();
  });

  test("writes escaped error annotations to stdout in GitHub Actions", () => {
    const processRef = getTestProcess();
    originalGitHubActions = processRef.env.GITHUB_ACTIONS;
    processRef.env.GITHUB_ACTIONS = "true";

    const writeSpy = vi
      .spyOn(processRef.stdout, "write")
      .mockImplementation(() => true);

    emitWithSink(getGitHubActionsAnnotationSink(), (logger) => {
      logger.error("Screenshot capture failed", {
        error: new Error("Boom%\nline"),
      });
    });

    expect(writeSpy).toHaveBeenCalledWith(
      "::error::trizum.screenshots.capture: Screenshot capture failed (Error: Boom%25%0Aline)\n",
    );
  });

  test("honors level overrides and appends primitive error summaries", () => {
    const commands: string[] = [];

    emitWithSink(
      getGitHubActionsAnnotationSink({
        enabled: true,
        levels: {
          warning: "warning",
        },
        writeCommand(command) {
          commands.push(command);
        },
      }),
      (logger) => {
        logger.warning("Fell back to cached screenshot data", {
          error: "temporary outage",
        });
      },
    );

    expect(commands).toEqual([
      "::warning::trizum.screenshots.capture: Fell back to cached screenshot data (temporary outage)\n",
    ]);
  });

  test("avoids duplicating error summaries already present in the message", () => {
    const commands: string[] = [];

    emitWithSink(
      getGitHubActionsAnnotationSink({
        enabled: true,
        writeCommand(command) {
          commands.push(command);
        },
      }),
      (logger) => {
        logger.error("Screenshot capture failed (Error: Boom)", {
          error: new Error("Boom"),
        });
      },
    );

    expect(commands).toEqual([
      "::error::trizum.screenshots.capture: Screenshot capture failed (Error: Boom)\n",
    ]);
  });
});
