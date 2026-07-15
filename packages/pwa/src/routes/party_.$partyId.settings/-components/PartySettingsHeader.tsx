import type { ReactNode } from "react";
import { BackButton } from "#src/components/BackButton.js";
import type { ToOptions } from "@tanstack/react-router";

export function PartySettingsHeader({
  fallbackOptions = { to: "/party/$partyId" },
  submitButton,
  title,
}: {
  fallbackOptions?: Omit<ToOptions, "replace">;
  submitButton?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="mt-safe container flex h-16 items-center px-2">
      <BackButton fallbackOptions={fallbackOptions} />

      <h1 className="max-h-12 truncate px-4 text-xl font-medium">{title}</h1>

      <div className="flex-1" />
      {submitButton}
    </div>
  );
}
