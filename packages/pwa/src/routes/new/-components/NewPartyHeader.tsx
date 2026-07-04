import { Trans } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { BackButton } from "#src/components/BackButton.js";

export function NewPartyHeader({ submitButton }: { submitButton: ReactNode }) {
  return (
    <div className="mt-safe container flex h-16 items-center px-2">
      <BackButton fallbackOptions={{ to: "/" }} />

      <h1 className="max-h-12 truncate px-4 text-xl font-medium">
        <Trans>New trizum</Trans>
      </h1>

      <div className="flex-1" />
      {submitButton}
    </div>
  );
}
