import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrefixedIconSource } from "./index.js";
import { createIconSpritePlugin } from "./vite.js";

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "icon-sprite-plugin-test-"));
}

function writeFile(rootDir: string, relativePath: string, contents: string) {
  const filePath = path.join(rootDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");

  return filePath;
}

function getHookHandler(hook: unknown) {
  if (typeof hook === "function") {
    return hook;
  }

  if (
    hook &&
    typeof hook === "object" &&
    "handler" in hook &&
    typeof hook.handler === "function"
  ) {
    return hook.handler;
  }

  return undefined;
}

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("createIconSpritePlugin", () => {
  it("regenerates and reloads on matching source updates", () => {
    const rootDir = createTempProject();
    tempDirectories.push(rootDir);

    writeFile(rootDir, "src/app.tsx", 'const icon = "lucide.arrow-left";\n');
    const iconFile = writeFile(
      rootDir,
      "vendor/lucide/arrow-left.svg",
      '<svg viewBox="0 0 24 24"><path d="M4 12h12"/></svg>\n',
    );
    const plugin = createIconSpritePlugin({
      generatedSpriteFile: "src/generated/iconSprite.svg",
      generatedTypesFile: "src/generated/iconSprite.gen.ts",
      iconSources: [
        createPrefixedIconSource({
          directory: "vendor/lucide",
          prefix: "lucide",
        }),
      ],
    });
    const watcherAdd = vi.fn();
    const wsSend = vi.fn();

    getHookHandler(plugin.configResolved)?.({
      root: rootDir,
    });
    getHookHandler(plugin.configureServer)?.({
      watcher: {
        add: watcherAdd,
      },
      ws: {
        send: wsSend,
      },
    });

    writeFile(
      rootDir,
      "vendor/lucide/arrow-left.svg",
      '<svg viewBox="0 0 24 24"><path d="M6 12h10"/></svg>\n',
    );

    getHookHandler(plugin.handleHotUpdate)?.({
      file: iconFile,
      server: {
        ws: {
          send: wsSend,
        },
      },
    });

    expect(watcherAdd).toHaveBeenCalledOnce();
    expect(wsSend).toHaveBeenCalledWith({ type: "full-reload" });
  });

  it("ignores updates inside the generated directory", () => {
    const rootDir = createTempProject();
    tempDirectories.push(rootDir);

    writeFile(rootDir, "src/app.tsx", 'const icon = "lucide.arrow-left";\n');
    writeFile(
      rootDir,
      "vendor/lucide/arrow-left.svg",
      '<svg viewBox="0 0 24 24"><path d="M4 12h12"/></svg>\n',
    );
    const plugin = createIconSpritePlugin({
      generatedSpriteFile: "src/generated/iconSprite.svg",
      generatedTypesFile: "src/generated/iconSprite.gen.ts",
      iconSources: [
        createPrefixedIconSource({
          directory: "vendor/lucide",
          prefix: "lucide",
        }),
      ],
    });
    const wsSend = vi.fn();

    getHookHandler(plugin.configResolved)?.({
      root: rootDir,
    });
    getHookHandler(plugin.buildStart)?.();
    writeFile(rootDir, "src/generated/iconSprite.svg", "<svg />\n");

    getHookHandler(plugin.handleHotUpdate)?.({
      file: path.join(rootDir, "src/generated/iconSprite.svg"),
      server: {
        ws: {
          send: wsSend,
        },
      },
    });

    expect(wsSend).not.toHaveBeenCalled();
  });
});
