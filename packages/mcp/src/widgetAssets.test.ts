import { readFile } from "node:fs/promises";
import { expect, it } from "vite-plus/test";
import { createWidgetHtml } from "./widgetHtml.js";

it("keeps the complete embedded widget below its 768 KiB payload budget", async () => {
  const [script, styles, sprite] = await Promise.all(
    ["js", "css", "svg"].map((extension) =>
      readFile(new URL(`../dist/widget.${extension}`, import.meta.url), "utf8"),
    ),
  );

  const html = createWidgetHtml({ script, styles, sprite });

  expect(Buffer.byteLength(html)).toBeLessThan(768 * 1024);
  expect(styles).toContain("data:font/woff2;base64,");
  expect(styles).toContain("Inter Variable");
  expect(styles).toContain("Fira Code Variable");
});
