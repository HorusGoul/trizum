import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Avatar } from "#src/ui/Avatar.js";
import { Button } from "#src/ui/Button.js";
import { Icon } from "#src/ui/Icon.js";
import { Skeleton } from "#src/ui/Skeleton.js";
import { useMediaFileActions } from "#src/hooks/useMediaFileActions.js";
import { useMediaFile } from "#src/hooks/useMediaFile.js";
import { compressionPresets } from "#src/lib/imageCompression.js";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";
import type { MediaFile } from "#src/models/media.ts";

interface AvatarPickerProps {
  value: MediaFile["id"] | null;
  name?: string;
  onChange: (avatarId: MediaFile["id"] | null) => void;
  className?: string;
}

export function AvatarPicker({
  value,
  name,
  onChange,
  className,
}: AvatarPickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { createMediaFile } = useMediaFileActions();
  const [isUploading, setIsUploading] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error(t`Please select an image file`);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error(t`Image must be smaller than 10MB`);
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(t`Uploading avatar...`);

    try {
      const [mediaFileId] = await createMediaFile(
        file,
        { type: "avatar" },
        compressionPresets.maximum,
      );

      // Pass the media file ID directly
      onChange(mediaFileId);

      toast.dismiss(toastId);
      toast.success(t`Avatar updated successfully`);
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      toast.dismiss(toastId);
      toast.error(t`Failed to upload avatar. Please try again.`);
    } finally {
      setIsUploading(false);
      // Reset the input value to allow selecting the same file again
      event.target.value = "";
    }
  }

  function handleRemoveAvatar() {
    onChange(null);
    toast.success(t`Avatar removed`);
  }

  function openCamera() {
    cameraInputRef.current?.click();
  }

  function openGallery() {
    galleryInputRef.current?.click();
  }

  return (
    <div className={`flex items-center gap-4 ${className || ""}`}>
      <div className="relative">
        {value ? (
          <Suspense fallback={<Skeleton className="h-32 w-32 rounded-full" />}>
            <AvatarWithImage avatarId={value} name={name} />
          </Suspense>
        ) : (
          <Avatar url={undefined} name={name} className="h-32 w-32 text-lg" />
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
        {value && (
          <Button
            color="input-like"
            className="absolute right-1 top-1 h-auto w-auto rounded-full p-1"
            onPress={handleRemoveAvatar}
            isDisabled={isUploading}
          >
            <Icon
              name="#lucide/x"
              className="h-4 w-4"
              aria-label={t`Remove avatar`}
            />
          </Button>
        )}
      </div>

      <div className="flex h-32 w-max flex-shrink-0 flex-col gap-2">
        <Button
          onPress={openCamera}
          color="input-like"
          className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
        >
          <Icon name="#lucide/camera" className="h-5 w-5" />
          <Trans>Take photo</Trans>
        </Button>

        <Button
          onPress={openGallery}
          color="input-like"
          className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-3 text-xs"
        >
          <Icon name="#lucide/image-up" className="h-5 w-5" />
          <Trans>Upload photo</Trans>
        </Button>
      </div>

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        capture="environment"
        multiple={false}
        onChange={(event) => void onFileChange(event)}
        ref={cameraInputRef}
        hidden={true}
      />

      <input
        type="file"
        className="sr-only"
        accept="image/*"
        multiple={false}
        onChange={(event) => void onFileChange(event)}
        ref={galleryInputRef}
        hidden={true}
      />
    </div>
  );
}

interface AvatarWithImageProps {
  avatarId: MediaFile["id"];
  name?: string;
}

function AvatarWithImage({ avatarId, name }: AvatarWithImageProps) {
  const { url } = useMediaFile(avatarId);

  return <Avatar url={url} name={name} className="h-32 w-32 text-lg" />;
}
