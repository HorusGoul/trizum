import { t } from "@lingui/core/macro";
import { Suspense } from "react";
import type { Expense } from "#src/models/expense.js";
import { Icon } from "#src/ui/Icon.js";
import { Skeleton } from "#src/ui/Skeleton.tsx";
import { PhotoItemById } from "./PhotoItemById.js";

interface PhotosProps extends Partial<Pick<Expense, "photos">> {
  onOpenGallery: (index: number) => void;
}

const EMPTY_PHOTOS: Expense["photos"] = [];

export function Photos({ photos = EMPTY_PHOTOS, onOpenGallery }: PhotosProps) {
  const hasMultiple = photos.length > 1;

  if (photos.length === 0) {
    return null;
  }

  return (
    <dl className="flex flex-col gap-4">
      <dt className="flex items-center gap-2">
        <Icon icon={hasMultiple ? "lucide.images" : "lucide.image"} aria-hidden="true" />

        <span className="font-medium">{t`Attachments`}</span>
      </dt>

      <dd className="-mx-4 -my-4 flex gap-4 overflow-x-auto px-4 py-4">
        {photos.map((photoId, index) => (
          <Suspense key={photoId} fallback={<Skeleton className="h-32 w-32" />}>
            <PhotoItemById photoId={photoId} onPress={() => onOpenGallery(index)} />
          </Suspense>
        ))}
      </dd>
    </dl>
  );
}
