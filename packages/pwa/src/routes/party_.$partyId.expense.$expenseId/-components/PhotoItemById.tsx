import { useFateClient, useView } from "react-fate";
import { requireAvailable } from "#src/lib/data/availability.ts";
import type { MediaEntity } from "#src/lib/data/entities.ts";
import { view } from "@nkzw/fate";
import { t } from "@lingui/core/macro";
import { useMediaFileObjectUrls } from "#src/hooks/useMediaFileObjectUrls.ts";
import { Button } from "@trizum/ui/Button";

const MediaPreviewView = view<MediaEntity>()({
  available: true,
  encodedBlob: true,
  metadata: true,
});

export function PhotoItemById({ photoId, onPress }: { photoId: string; onPress: () => void }) {
  const client = useFateClient();

  const mediaFile = requireAvailable(
    useView(MediaPreviewView, client.ref<MediaEntity>("Media", photoId, MediaPreviewView)),
  );

  const [url] = useMediaFileObjectUrls([mediaFile]);

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
