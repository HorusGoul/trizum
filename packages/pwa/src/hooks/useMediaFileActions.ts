import { useAppData } from "#src/lib/data/useAppData.ts";

export { getImageUploadErrorMessage } from "#src/lib/data/mediaCommands.ts";

export function useMediaFileActions() {
  return useAppData().media;
}
