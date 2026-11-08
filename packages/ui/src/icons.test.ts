import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateIconSpriteArtifacts } from "@trizum/icon-sprite";
import { describe, expect, test } from "vite-plus/test";
import { createUIIconSpriteConfig } from "./icons.js";

describe("consumer icon generation", () => {
  test("includes consumer icons and icons used inside design-system components", () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "trizum-ui-icons-"));

    try {
      mkdirSync(path.join(rootDir, "src"));
      const consumerIcon = ["lucide", "banana"].join(".");
      writeFileSync(path.join(rootDir, "src", "App.tsx"), `<Icon icon="${consumerIcon}" />`);
      const result = generateIconSpriteArtifacts({ config: createUIIconSpriteConfig(), rootDir });
      expect(result.usedIds).toContain(consumerIcon);
      expect(result.usedIds).toContain(["lucide", "chevron-down"].join("."));
      expect(result.usedIds).toContain(["lucide", "loader-circle"].join("."));
      expect(result.availableIds).toContain(["brand", "github"].join("."));
      expect(result.usedIds).not.toContain(["brand", "github"].join("."));
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
