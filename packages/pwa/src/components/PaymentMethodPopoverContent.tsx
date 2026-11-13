import { useEffect, useEffectEvent, type ReactNode } from "react";

/** Defer editor focus until the popover and its focus scope have unmounted. */
export function PaymentMethodPopoverContent({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const finishClose = useEffectEvent(onClose);
  useEffect(() => () => finishClose(), []);

  return children;
}
