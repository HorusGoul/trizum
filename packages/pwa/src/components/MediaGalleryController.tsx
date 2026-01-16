import { useState, useCallback } from "react";
import { MediaGalleryContext } from "./MediaGalleryContext";
import type { MediaGalleryItem } from "./MediaGallery";
import { Modal, ModalOverlay } from "react-aria-components";
import MediaGallery from "./MediaGallery";

interface MediaGalleryControllerProps {
  children: React.ReactNode;
}

export interface MediaGalleryControllerState {
  items: MediaGalleryItem[];
  index: number;
}

export function MediaGalleryController({
  children,
}: MediaGalleryControllerProps) {
  const [state, setState] = useState<MediaGalleryControllerState>({
    items: [],
    index: -1,
  });
  const [dragProgress, setDragProgress] = useState(0);

  function open(state: Pick<MediaGalleryControllerState, "items" | "index">) {
    setState((current) => ({ ...current, ...state }));
  }

  function close() {
    setState((current) => ({ ...current, items: [], index: -1 }));
    setDragProgress(0);
  }

  const handleDragProgress = useCallback((progress: number) => {
    setDragProgress(progress);
  }, []);

  // Calculate background opacity: starts at 0.25 (25% black), fades to 0 as drag progresses
  const backgroundOpacity = 0.25 * (1 - dragProgress);
  // Calculate blur: starts at full blur, reduces as drag progresses
  const backdropBlur = `blur(${(1 - dragProgress) * 8}px)`;

  return (
    <MediaGalleryContext value={{ state, open, close }}>
      {children}

      <ModalOverlay
        isOpen={state.index !== -1}
        className={({ isEntering, isExiting }) =>
          `absolute left-0 top-0 isolate z-10 h-full w-full ${isEntering ? "duration-300 ease-out animate-in fade-in" : ""} ${isExiting ? "duration-200 ease-in animate-out fade-out" : ""} `
        }
        style={{
          backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity})`,
          backdropFilter: backdropBlur,
          WebkitBackdropFilter: backdropBlur,
        }}
      >
        <Modal className="h-full w-full">
          {state.index !== -1 && (
            <MediaGallery
              index={state.index}
              items={state.items}
              onChange={(index) =>
                setState((current) => ({ ...current, index }))
              }
              onClose={close}
              onDragProgress={handleDragProgress}
            />
          )}
        </Modal>
      </ModalOverlay>
    </MediaGalleryContext>
  );
}
