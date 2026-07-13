import { describe, expect, it } from "vite-plus/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ICON_CONCEPTS, ICON_CONCEPT_SIZE, renderIconConceptSvg } from "./icon-concepts.ts";

describe("icon concepts", () => {
  it("defines three distinct vector concepts", () => {
    expect(ICON_CONCEPTS.map(({ id }) => id)).toEqual([
      "midnight-flat",
      "midnight-layered",
      "balanced-split",
    ]);

    for (const concept of ICON_CONCEPTS) {
      const svg = renderIconConceptSvg(concept.id);
      expect(svg).toContain('viewBox="0 0 512 512"');
      expect(svg).toContain('stroke-linecap="round"');
    }
  });

  it("commits deterministic RGB concept renders at review size", async () => {
    for (const concept of ICON_CONCEPTS) {
      const png = await readFile(
        path.resolve(import.meta.dirname, "../icon-concepts", `${concept.id}.png`),
      );

      expect(png.readUInt32BE(16)).toBe(ICON_CONCEPT_SIZE);
      expect(png.readUInt32BE(20)).toBe(ICON_CONCEPT_SIZE);
      expect(png[24]).toBe(8);
      expect(png[25]).toBe(2);
    }
  });
});
