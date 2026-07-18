import { Trans } from "@lingui/react/macro";
import { Alert, AlertDescription, AlertTitle } from "#src/ui/Alert.tsx";
import { Icon } from "#src/ui/Icon.tsx";

export function ArchivedParticipantsAlert({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }

  return (
    <Alert variant="default" className="mt-4">
      <Icon icon="lucide.archive" />
      <AlertTitle>
        <Trans>Archived participants are still configured</Trans>
      </AlertTitle>
      <AlertDescription>
        <Trans>They will be omitted from new expenses unless they are restored to the party.</Trans>
      </AlertDescription>
    </Alert>
  );
}
