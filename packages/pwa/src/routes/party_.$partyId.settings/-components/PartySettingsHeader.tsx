import { Trans } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { BackButton } from "#src/components/BackButton.js";

export function PartySettingsHeader({ submitButton }: { submitButton: ReactNode }) {
  return (
    <div className="container flex h-16 items-center px-2 mt-safe">
      <BackButton fallbackOptions={{ to: "/party/$partyId" }} />

      <h1 className="max-h-12 truncate px-4 text-xl font-medium">
        <Trans>Party Settings</Trans>
      </h1>

      <div className="flex-1" />
      {submitButton}
    </div>
  );
}
