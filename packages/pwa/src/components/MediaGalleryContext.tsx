import { createContext } from "react";
import type { MediaGalleryControllerState } from "./MediaGalleryController";

interface MediaGalleryContextType {
  state: MediaGalleryControllerState;
  open: (state: Pick<MediaGalleryControllerState, "items" | "index">) => void;
  close: () => void;
}

export const MediaGalleryContext = createContext<MediaGalleryContextType>({
  state: {
    items: [],
    index: 0,
  },
  open: () => {},
  close: () => {},
});
