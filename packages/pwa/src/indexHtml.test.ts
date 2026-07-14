import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("index.html", () => {
  it("lets native WebViews expose system-bar safe areas to CSS", () => {
    expect(indexHtml).toContain("viewport-fit=cover");
  });
});
