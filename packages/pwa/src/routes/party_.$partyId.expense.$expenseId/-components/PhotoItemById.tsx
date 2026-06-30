import { t } from "@lingui/core/macro";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import { Button } from "#src/ui/Button.tsx";

export function PhotoItemById({ photoId, onPress }: { photoId: string; onPress: () => void }) {
  const { url } = useMediaFile(photoId);

  return (
    <Button
      color="transparent"
      aria-label={t`View photo`}
      className="h-auto w-auto p-0"
      onContextMenu={(e) => e.preventDefault()}
      onPress={onPress}
    >
      <img src={url} className="block h-32 w-32 rounded-xl object-cover" alt="" />
    </Button>
  );
}
