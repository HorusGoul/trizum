import { useEffect, useEffectEvent, useState } from "react";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";

type PremiumDialog =
  | { kind: "closed" }
  | { kind: "browserHelp" }
  | { kind: "signIn"; intent: "account" | "premium" }
  | { kind: "premium"; userId: string };

export function usePremiumDialogs({
  userId,
  isNative,
  presentPaywall,
}: {
  userId: string | null;
  isNative: boolean;
  presentPaywall: () => Promise<unknown>;
}) {
  const [dialog, setDialog] = useState<PremiumDialog>({ kind: "closed" });
  const readyPremium = dialog.kind === "premium" && dialog.userId === userId ? dialog : null;
  const openPaywall = useEffectEvent(async () => {
    try {
      await presentPaywall();
    } catch {
      toast.error(t`Could not open Premium. Please try again.`);
    }
  });

  useEffect(() => {
    if (!readyPremium) return;
    // Completion waits for the provider's account, then remains pending until dismissal.
    void openPaywall().then(() => {
      setDialog((current) => (current === readyPremium ? { kind: "closed" } : current));
    });
  }, [readyPremium]);

  function openPremium() {
    if (!isNative) setDialog({ kind: "browserHelp" });
    else if (userId) setDialog({ kind: "premium", userId });
    else setDialog({ kind: "signIn", intent: "premium" });
  }

  function signIn() {
    setDialog({ kind: "signIn", intent: "account" });
  }

  function signedIn(authenticatedUserId: string) {
    setDialog((current) => {
      if (current !== dialog || current.kind !== "signIn") return current;
      return current.intent === "premium"
        ? { kind: "premium", userId: authenticatedUserId }
        : { kind: "closed" };
    });
  }

  function close() {
    // The sign-in view calls onClose after onSignedIn; preserve its queued Premium action.
    setDialog((current) =>
      current === dialog && (current.kind === "signIn" || current.kind === "browserHelp")
        ? { kind: "closed" }
        : current,
    );
  }

  return { dialog, openPremium, signIn, signedIn, close };
}
