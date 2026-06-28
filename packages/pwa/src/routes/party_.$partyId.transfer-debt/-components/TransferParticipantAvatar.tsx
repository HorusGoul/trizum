import { Suspense } from "react";
import { useMediaFile } from "#src/hooks/useMediaFile.ts";
import type { PartyParticipant } from "#src/models/party.ts";
import { Avatar } from "#src/ui/Avatar.tsx";

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
  const { url } = useMediaFile(avatarId);

  return <Avatar className={className} name={name} url={url} />;
}
