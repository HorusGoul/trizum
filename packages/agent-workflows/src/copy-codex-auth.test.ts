/// <reference types="node" />
import { spawnSync as realSpawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import type * as OsModule from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { copyCodexAuth, type CodexAuthRuntime } from "./copy-codex-auth.js";

const spawnSync = vi.fn<CodexAuthRuntime["spawnSync"]>();
const platform = vi.fn<typeof OsModule.platform>();

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
  platform.mockReturnValue("darwin");
  vi.spyOn(process.stdout, "write").mockImplementation(output);
  vi.stubEnv("CODEX_HOME", "/personal-codex-home");
  vi.stubEnv("OPENAI_API_KEY", "personal-api-key");
  vi.stubEnv("CODEX_ACCESS_TOKEN", "personal-access-token");
  vi.stubEnv("BW_ACCESS_TOKEN", "bitwarden-token");
  spawnSync.mockImplementation((command, _args, options) => {
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
  await copyCodexAuth({ spawnSync, platform });

  expect(spawnSync).toHaveBeenNthCalledWith(
    1,
    "codex",
    ["login", "-c", 'cli_auth_credentials_store="file"'],
    expect.objectContaining({ stdio: "inherit" }),
  );
  const loginEnvironment = spawnSync.mock.calls[0]?.[2]?.env;
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
    spawnSync.mockImplementationOnce((_command, _args, options) => {
      ciAuthDirectory = options?.env?.CODEX_HOME ?? "";
      writeFileSync(path.join(ciAuthDirectory, "auth.json"), contents);

      return success;
    });
    await expect(copyCodexAuth({ spawnSync, platform })).rejects.toThrow("Codex did not create");
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(existsSync(ciAuthDirectory)).toBe(false);
  },
);

test("does not attempt clipboard access after a failed login", async () => {
  spawnSync.mockImplementationOnce((_command, _args, options) => {
    ciAuthDirectory = options?.env?.CODEX_HOME ?? "";

    return { ...success, status: 1 };
  });
  await expect(copyCodexAuth({ spawnSync, platform })).rejects.toThrow(
    "Codex login did not complete",
  );
  expect(spawnSync).toHaveBeenCalledTimes(1);
  expect(existsSync(ciAuthDirectory)).toBe(false);
});

test("cleans up after clipboard failure without including captured credentials in the error", async () => {
  const login = spawnSync.getMockImplementation();
  spawnSync.mockImplementation((command, args, options) => {
    if (command === "codex" && login != null) return login(command, args, options);

    return { ...success, status: 1, stderr: JSON.stringify(credentials) };
  });
  await expect(copyCodexAuth({ spawnSync, platform })).rejects.toThrow(
    /^Could not copy credentials using pbcopy\./,
  );
  expect(existsSync(ciAuthDirectory)).toBe(false);
});

test("returns after the X11 clipboard parent exits while its background owner keeps stderr", async () => {
  platform.mockReturnValue("linux");
  vi.stubEnv("WAYLAND_DISPLAY", "");
  const login = spawnSync.getMockImplementation();
  spawnSync.mockImplementation((command, args, options) => {
    if (command === "codex" && login != null) return login(command, args, options);

    return realSpawnSync(
      process.execPath,
      [
        "-e",
        `require('node:fs').readFileSync(0);
         require('node:child_process').spawn(process.execPath,
           ['-e', 'setTimeout(() => {}, 1000)'],
           { detached: true, stdio: ['ignore', 'ignore', 2] }).unref();`,
      ],
      { ...options, encoding: "utf8", timeout: 500 },
    );
  });

  await expect(copyCodexAuth({ spawnSync, platform })).resolves.toBeUndefined();
  expect(spawnSync).toHaveBeenLastCalledWith(
    "xclip",
    ["-selection", "clipboard"],
    expect.objectContaining({ input: JSON.stringify(credentials) }),
  );
  expect(existsSync(ciAuthDirectory)).toBe(false);
});
