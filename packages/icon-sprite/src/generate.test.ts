import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPrefixedIconSource,
  createSetDirectoryIconSource,
  generateIconSpriteArtifacts,
} from "./index.js";

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "icon-sprite-test-"));
}

function writeFile(rootDir: string, relativePath: string, contents: string) {
  const filePath = path.join(rootDir, relativePath);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");

  return filePath;
}

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("generateIconSpriteArtifacts", () => {
  it("generates typed IDs for the full catalog and a sprite for only used icons", () => {
    const rootDir = createTempProject();
    tempDirectories.push(rootDir);

    writeFile(
      rootDir,
      "src/app.tsx",
      [
        'const first = "lucide.arrow-left";',
        'const second = "brand.github";',
        "",
      ].join("\n"),
    );
    writeFile(
      rootDir,
      "vendor/lucide/arrow-left.svg",
      '<svg viewBox="0 0 24 24"><path d="M12 4 4 12l8 8"/></svg>\n',
    );
    writeFile(
      rootDir,
      "vendor/lucide/arrow-right.svg",
      '<svg viewBox="0 0 24 24"><path d="m12 4 8 8-8 8"/></svg>\n',
    );
    writeFile(
      rootDir,
      "src/icons/brand/github.svg",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20"/></svg>\n',
    );

    const result = generateIconSpriteArtifacts({
      rootDir,
      config: {
        generatedSpriteFile: "src/generated/iconSprite.svg",
        generatedTypesFile: "src/generated/iconSprite.gen.ts",
        iconSources: [
          createPrefixedIconSource({
            directory: "vendor/lucide",
            prefix: "lucide",
          }),
          createSetDirectoryIconSource({
            directory: "src/icons",
          }),
        ],
      },
    });

    const typesSource = fs.readFileSync(
      path.join(rootDir, "src/generated/iconSprite.gen.ts"),
      "utf8",
    );
    const spriteSource = fs.readFileSync(
      path.join(rootDir, "src/generated/iconSprite.svg"),
      "utf8",
    );

    expect(result.availableIds).toEqual([
      "brand.github",
      "lucide.arrow-left",
      "lucide.arrow-right",
    ]);
    expect(result.usedIds).toEqual(["brand.github", "lucide.arrow-left"]);
    expect(typesSource).toContain('"lucide.arrow-right"');
    expect(spriteSource).toContain('id="lucide.arrow-left"');
    expect(spriteSource).toContain('id="brand.github"');
    expect(spriteSource).not.toContain('id="lucide.arrow-right"');
    expect(spriteSource).toContain('fill="currentColor"');
    expect(spriteSource).toContain('stroke="currentColor"');
  });

  it("ignores generated files when scanning usage", () => {
    const rootDir = createTempProject();
    tempDirectories.push(rootDir);

    writeFile(rootDir, "src/app.tsx", 'const icon = "lucide.arrow-left";\n');
    writeFile(
      rootDir,
      "src/generated/ignored.ts",
      'const shouldNotCount = "lucide.arrow-right";\n',
    );
    writeFile(
      rootDir,
      "vendor/lucide/arrow-left.svg",
      '<svg viewBox="0 0 24 24"><path d="M4 12h12"/></svg>\n',
    );
    writeFile(
      rootDir,
      "vendor/lucide/arrow-right.svg",
      '<svg viewBox="0 0 24 24"><path d="M8 6l8 6-8 6"/></svg>\n',
    );

    const result = generateIconSpriteArtifacts({
      rootDir,
      config: {
        generatedSpriteFile: "src/generated/iconSprite.svg",
        generatedTypesFile: "src/generated/iconSprite.gen.ts",
        iconSources: [
          createPrefixedIconSource({
            directory: "vendor/lucide",
            prefix: "lucide",
          }),
        ],
      },
    });

    expect(result.usedIds).toEqual(["lucide.arrow-left"]);
  });
});
