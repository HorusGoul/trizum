import { describe, expect, it, vi } from "vite-plus/test";
import { createMediaGalleryItemLoader, type MediaGalleryItem } from "./mediaGalleryItemLoader.ts";

describe("createMediaGalleryItemLoader", () => {
  it("loads the selected item first without waiting for earlier items", async () => {
    const resolveBySrc = new Map<string, (item: MediaGalleryItem) => void>();
    const loadItem = vi.fn<(item: MediaGalleryItem) => Promise<MediaGalleryItem>>(
      (item: MediaGalleryItem) =>
        new Promise<MediaGalleryItem>((resolve) => {
          resolveBySrc.set(item.src, resolve);
        }),
    );
    const loader = createMediaGalleryItemLoader(loadItem);
    const items = [{ src: "first" }, { src: "second" }, { src: "third" }];

    const selectedItemPromise = loader.read(items, 1);

    expect(loadItem.mock.calls.map(([item]) => item.src)).toEqual(["second", "first", "third"]);

    resolveBySrc.get("second")?.(items[1]);

    await expect(selectedItemPromise).resolves.toEqual(items[1]);
  });
});
