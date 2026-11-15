import { expect, test, vi } from "vite-plus/test";
import { embedPreviewEmoji } from "./previewEmoji";

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>';

test("uses Fluent artwork and fetches each distinct emoji once", async () => {
  const fetchAsset = vi.fn<(url: string) => Promise<Response>>(async () => new Response(svg));
  const html = await embedPreviewEmoji("<div>🏝️ Holiday 🏝️</div>", fetchAsset);
  expect(fetchAsset).toHaveBeenCalledExactlyOnceWith(
    "https://cdn.jsdelivr.net/gh/shuding/fluentui-emoji-unicode/assets/1f3dd_color.svg",
  );
  expect(html.match(/<img /g)).toHaveLength(2);
  expect(html).toContain(`data:image/svg+xml;base64,${btoa(svg)}`);
  expect(html).toContain("Holiday");
});

test("falls back for flags everywhere in preview HTML", async () => {
  const fetchAsset = vi.fn<(url: string) => Promise<Response>>(async (url) =>
    url.includes("fluentui") ? new Response("Not found", { status: 404 }) : new Response(svg),
  );

  const html = await embedPreviewEmoji(
    "<div>🇪🇸</div><div>Trip 🇺🇸</div><div>🇪🇸 again</div>",
    fetchAsset,
  );

  expect(fetchAsset).toHaveBeenCalledWith(
    "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f1ea-1f1f8.svg",
  );
  expect(fetchAsset).toHaveBeenCalledWith(
    "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f1fa-1f1f8.svg",
  );
  expect(html.match(/<img /g)).toHaveLength(3);
  expect(html).not.toContain(btoa("Not found"));
});

test("does not embed failed asset responses", async () => {
  await expect(
    embedPreviewEmoji("🇪🇸", async () => new Response("Unavailable", { status: 503 })),
  ).rejects.toThrow("Could not load preview emoji artwork: 503");
});
