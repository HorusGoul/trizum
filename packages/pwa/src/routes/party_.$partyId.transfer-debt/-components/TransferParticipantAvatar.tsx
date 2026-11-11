import { useFateClient, useView } from "react-fate";
import { requireAvailable } from "#src/lib/data/availability.ts";
import type { MediaEntity } from "#src/lib/data/entities.ts";
import { view } from "@nkzw/fate";
import { Suspense } from "react";
import { useMediaFileObjectUrls } from "#src/hooks/useMediaFileObjectUrls.ts";
import type { PartyParticipant } from "#src/models/party.ts";
import { Avatar } from "@trizum/ui/Avatar";

const MediaPreviewView = view<MediaEntity>()({
  available: true,
  encodedBlob: true,
  metadata: true,
});

export function TransferParticipantAvatar({
  participant,
  className,
}: {
  participant: PartyParticipant;
  className?: string;
}) {
  if (!participant.avatarId) {
    return <Avatar className={className} name={participant.name} />;
  }

  return (
    <Suspense fallback={<Avatar className={className} name={participant.name} />}>
      <TransferParticipantAvatarImage
        avatarId={participant.avatarId}
        className={className}
        name={participant.name}
      />
    </Suspense>
  );
}

function TransferParticipantAvatarImage({
  avatarId,
  name,
  className,
}: {
  avatarId: NonNullable<PartyParticipant["avatarId"]>;
  name: string;
  className?: string;
}) {
  const client = useFateClient();

  const mediaFile = requireAvailable(
    useView(MediaPreviewView, client.ref<MediaEntity>("Media", avatarId, MediaPreviewView)),
  );

  const [url] = useMediaFileObjectUrls([mediaFile]);

  return <Avatar className={className} name={name} url={url} />;
}
