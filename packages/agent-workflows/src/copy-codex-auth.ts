import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { createSanitizedEnvironment } from "./adapters/exec.js";

const authSchema = z.object({
  auth_mode: z.literal("chatgpt"),
  tokens: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
});

export async function copyCodexAuth(): Promise<void> {
  const ciAuthDirectory = await mkdtemp(path.join(tmpdir(), "trizum-codex-auth-"));
  try {
    const login = spawnSync("codex", ["login", "-c", 'cli_auth_credentials_store="file"'], {
      env: { ...createSanitizedEnvironment(), CODEX_HOME: ciAuthDirectory },
      stdio: "inherit",
    });
    if (login.error != null || login.status !== 0) {
      throw new Error("Codex login did not complete. Run `vp run codex:auth` to try again.");
    }

    // Preserve the whole bundle, including fields unknown to this helper.
    let credentials: unknown;
    try {
      credentials = JSON.parse(await readFile(path.join(ciAuthDirectory, "auth.json"), "utf8"));
    } catch {
      throw new Error("Codex did not create a readable auth.json. No credentials were copied.");
    }
    if (!authSchema.safeParse(credentials).success) {
      throw new Error("Codex did not create a ChatGPT login with refresh credentials.");
    }

    const [command, ...args] = clipboardCommand();
    const clipboard = spawnSync(command, args, {
      env: createSanitizedEnvironment(),
      input: JSON.stringify(credentials),
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 5_000,
    });
    if (clipboard.error != null || clipboard.status !== 0) {
      throw new Error(
        `Could not copy credentials using ${command}. Ensure a desktop clipboard is available (pbcopy on macOS, PowerShell on Windows, wl-copy or xclip on Linux), then rerun \`vp run codex:auth\`.`,
      );
    }

    process.stdout.write(
      "Codex CI credentials copied to the clipboard. When no agent review is running, paste them into the Bitwarden secret referenced by BITWARDEN_CODEX_AUTH_JSON_SECRET_ID, save it, then rerun the workflow.\n",
    );
  } finally {
    await rm(ciAuthDirectory, { force: true, recursive: true });
  }
}

function clipboardCommand(): [string, ...string[]] {
  switch (platform()) {
    case "darwin":
      return ["pbcopy"];
    case "win32":
      return [
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "[Console]::In.ReadToEnd() | Set-Clipboard",
      ];
    case "linux":
      return process.env.WAYLAND_DISPLAY ? ["wl-copy"] : ["xclip", "-selection", "clipboard"];
    default:
      throw new Error("Clipboard copying is supported on macOS, Windows, and Linux.");
  }
}
