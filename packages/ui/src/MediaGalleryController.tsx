import { useState, useRef } from "react";
import { MediaGalleryContext } from "./MediaGalleryContext.js";
import type { MediaGalleryItem } from "./MediaGallery.js";
import { Modal, ModalOverlay } from "react-aria-components";
import MediaGallery from "./MediaGallery.js";

interface MediaGalleryControllerProps {
  children: React.ReactNode;
}

export interface MediaGalleryControllerState {
  items: MediaGalleryItem[];
  index: number;
}

export function MediaGalleryController({ children }: MediaGalleryControllerProps) {
  const [state, setState] = useState<MediaGalleryControllerState>({
    items: [],
    index: -1,
  });

  const overlayRef = useRef<HTMLDivElement>(null);

  function setDragProgress(progress: number) {
    const overlay = overlayRef.current;

    if (!overlay) return;
    overlay.style.backgroundColor = `rgba(0, 0, 0, ${0.25 * (1 - progress)})`;
    overlay.style.backdropFilter = `blur(${8 * (1 - progress)}px)`;
    overlay.style.setProperty("-webkit-backdrop-filter", `blur(${8 * (1 - progress)}px)`);
  }

  function open(state: Pick<MediaGalleryControllerState, "items" | "index">) {
    setState((current) => ({ ...current, ...state }));
  }

  function close() {
    setState((current) => ({ ...current, items: [], index: -1 }));
    setDragProgress(0);
  }

  function handleDragProgress(progress: number) {
    setDragProgress(progress);
  }

  return (
    <MediaGalleryContext value={{ state, open, close }}>
      {children}

      <ModalOverlay
        ref={overlayRef}
        isOpen={state.index !== -1}
        className={({ isEntering, isExiting }) =>
          `fixed inset-0 isolate z-50 ${isEntering ? "animate-in fade-in duration-300 ease-out" : ""} ${isExiting ? "animate-out fade-out duration-200 ease-in" : ""} `
        }
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <Modal className="h-full w-full">
          {state.index !== -1 && (
            <MediaGallery
              index={state.index}
              items={state.items}
              onChange={(index) => {
                setDragProgress(0);
                setState((current) => ({ ...current, index }));
              }}
              onClose={close}
              onDragProgress={handleDragProgress}
            />
          )}
        </Modal>
      </ModalOverlay>
    </MediaGalleryContext>
  );
}
