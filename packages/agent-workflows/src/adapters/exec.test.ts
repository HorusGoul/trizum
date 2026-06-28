import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  createSanitizedEnvironment,
  createSecretScrubEnvironmentOverrides,
  redactSecrets,
} from "./exec.js";

type TestEnvironment = Record<string, string | undefined>;

const testEnvironment = (globalThis as unknown as { process: { env: TestEnvironment } }).process
  .env;
const previousGhToken = testEnvironment.GH_TOKEN;
const previousCodexHome = testEnvironment.CODEX_HOME;

describe("command environment helpers", () => {
  afterEach(() => {
    restoreEnv("GH_TOKEN", previousGhToken);
    restoreEnv("CODEX_HOME", previousCodexHome);
  });

  test("scrubs workflow credentials from untrusted child environments", () => {
    testEnvironment.GH_TOKEN = "ghp_123456789012345678901234567890123456";
    testEnvironment.CODEX_HOME = "/tmp/codex-auth";

    const environment = createSanitizedEnvironment();

    expect(environment.GH_TOKEN).toBeUndefined();
    expect(environment.CODEX_HOME).toBeUndefined();
  });

  test("can preserve Codex home while blanking GitHub credentials for the agent process", () => {
    testEnvironment.GH_TOKEN = "ghp_123456789012345678901234567890123456";
    testEnvironment.CODEX_HOME = "/tmp/codex-auth";

    const overrides = createSecretScrubEnvironmentOverrides({
      preserveCodexHome: true,
    });

    expect(overrides.GH_TOKEN).toBe("");
    expect(overrides.CODEX_HOME).toBeUndefined();
  });

  test("redacts current credential values and common token shapes", () => {
    testEnvironment.GH_TOKEN = "ghp_123456789012345678901234567890123456";

    expect(
      redactSecrets(
        'token ghp_123456789012345678901234567890123456 {"access_token":"secret-value"} sk-testsecretvalue1234567890',
      ),
    ).toBe('token [redacted] {"access_token":"[redacted]"} [redacted]');
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value == null) {
    delete testEnvironment[key];
    return;
  }

  testEnvironment[key] = value;
}
