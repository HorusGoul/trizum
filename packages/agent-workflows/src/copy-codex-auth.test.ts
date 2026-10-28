/// <reference types="node" />
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import type * as OsModule from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { copyCodexAuth } from "./copy-codex-auth.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn<typeof spawnSync>() }));
vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof OsModule>()),
  platform: vi.fn<typeof platform>(() => "darwin"),
}));

const credentials = {
  auth_mode: "chatgpt",
  tokens: {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    id_token: "test-id-token",
    account_id: "test-account",
  },
  last_refresh: "2026-10-28T00:00:00Z",
};
const success = {
  pid: 1,
  output: [],
  stdout: "",
  stderr: "",
  status: 0,
  signal: null,
};
let ciAuthDirectory: string;
const output = vi.fn<(...args: unknown[]) => boolean>(() => true);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(platform).mockReturnValue("darwin");
  vi.spyOn(process.stdout, "write").mockImplementation(output);
  vi.stubEnv("CODEX_HOME", "/personal-codex-home");
  vi.stubEnv("OPENAI_API_KEY", "personal-api-key");
  vi.stubEnv("CODEX_ACCESS_TOKEN", "personal-access-token");
  vi.stubEnv("BW_ACCESS_TOKEN", "bitwarden-token");
  vi.mocked(spawnSync).mockImplementation((command, _args, options) => {
    if (command === "codex") {
      ciAuthDirectory = options?.env?.CODEX_HOME ?? "";
      writeFileSync(path.join(ciAuthDirectory, "auth.json"), JSON.stringify(credentials));
    }
    return success;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("copies the entire bundle via stdin and removes the isolated login directory", async () => {
  await copyCodexAuth();

  expect(spawnSync).toHaveBeenNthCalledWith(
    1,
    "codex",
    ["login", "-c", 'cli_auth_credentials_store="file"'],
    expect.objectContaining({ stdio: "inherit" }),
  );
  const loginEnvironment = vi.mocked(spawnSync).mock.calls[0]?.[2]?.env;
  expect(loginEnvironment?.CODEX_HOME).not.toBe("/personal-codex-home");
  expect(loginEnvironment).not.toHaveProperty("OPENAI_API_KEY");
  expect(loginEnvironment).not.toHaveProperty("CODEX_ACCESS_TOKEN");
  expect(loginEnvironment).not.toHaveProperty("BW_ACCESS_TOKEN");
  expect(process.env.CODEX_HOME).toBe("/personal-codex-home");
  expect(spawnSync).toHaveBeenNthCalledWith(
    2,
    "pbcopy",
    [],
    expect.objectContaining({ input: JSON.stringify(credentials) }),
  );
  expect(existsSync(ciAuthDirectory)).toBe(false);
  expect(output).toHaveBeenCalledTimes(1);
  expect(output).not.toHaveBeenCalledWith(expect.stringContaining("test-access"));
});

test.each(["invalid json", JSON.stringify({ auth_mode: "chatgpt", tokens: {} })])(
  "does not copy a malformed credential bundle: %s",
  async (contents) => {
    vi.mocked(spawnSync).mockImplementationOnce((_command, _args, options) => {
      ciAuthDirectory = options?.env?.CODEX_HOME ?? "";
      writeFileSync(path.join(ciAuthDirectory, "auth.json"), contents);
      return success;
    });
    await expect(copyCodexAuth()).rejects.toThrow("Codex did not create");
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(existsSync(ciAuthDirectory)).toBe(false);
  },
);

test("does not attempt clipboard access after a failed login", async () => {
  vi.mocked(spawnSync).mockImplementationOnce((_command, _args, options) => {
    ciAuthDirectory = options?.env?.CODEX_HOME ?? "";
    return { ...success, status: 1 };
  });
  await expect(copyCodexAuth()).rejects.toThrow("Codex login did not complete");
  expect(spawnSync).toHaveBeenCalledTimes(1);
  expect(existsSync(ciAuthDirectory)).toBe(false);
});

test("cleans up after clipboard failure without including captured credentials in the error", async () => {
  const login = vi.mocked(spawnSync).getMockImplementation();
  vi.mocked(spawnSync).mockImplementation((command, args, options) => {
    if (command === "codex" && login != null) return login(command, args, options);
    return { ...success, status: 1, stderr: JSON.stringify(credentials) };
  });
  await expect(copyCodexAuth()).rejects.toThrow(/^Could not copy credentials using pbcopy\./);
  expect(existsSync(ciAuthDirectory)).toBe(false);
});
