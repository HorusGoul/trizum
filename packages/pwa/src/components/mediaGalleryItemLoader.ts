export interface MediaGalleryItem {
  src: string;
}

type LoadMediaGalleryItem = (item: MediaGalleryItem) => Promise<MediaGalleryItem>;

export function createMediaGalleryItemLoader(loadItem: LoadMediaGalleryItem) {
  const itemPromiseCacheBySrc = new Map<string, Promise<MediaGalleryItem>>();

  function load(item: MediaGalleryItem) {
    const cachedPromise = itemPromiseCacheBySrc.get(item.src);

    if (cachedPromise) {
      return cachedPromise;
    }

    const promise = loadItem(item).then(
      (loadedItem) => loadedItem,
      (error: unknown) => {
        itemPromiseCacheBySrc.delete(item.src);
        throw error;
      },
    );

    itemPromiseCacheBySrc.set(item.src, promise);
    return promise;
  }

  return {
    read(items: MediaGalleryItem[], index: number) {
      const selectedItem = items[index];

      if (!selectedItem) {
        throw new Error(`Media gallery item not found at index ${index}`);
      }

      // Start the selected image first so a cold gallery never waits for index 0.
      const selectedItemPromise = load(selectedItem);

      for (const [itemIndex, item] of items.entries()) {
        if (itemIndex !== index) {
          void load(item).catch(() => undefined);
        }
      }

      return selectedItemPromise;
    },
  };
}

export const mediaGalleryItemLoader = createMediaGalleryItemLoader(
  (originalItem: MediaGalleryItem) =>
    new Promise<MediaGalleryItem>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve(originalItem);
      };
      image.onerror = () => {
        reject(new Error(`Failed to load image ${originalItem.src}`));
      };
      image.src = originalItem.src;
    }),
);
