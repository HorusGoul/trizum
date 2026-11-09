import { useLingui } from "@lingui/react/macro";
import { Icon } from "@trizum/ui/Icon";
import { IconButton } from "@trizum/ui/IconButton";
import { mergeProps, useLink, useLongPress } from "react-aria";
import { useRef } from "react";
import { Button } from "react-aria-components";
import { trackEvent } from "#src/lib/analytics.ts";
import { getPaymentLink, paymentMethodLabels } from "#src/lib/paymentMethods.ts";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";
import { PaymentMethodIcon } from "#src/components/PaymentMethodIcon.tsx";
import { useCopyPaymentDetails } from "#src/hooks/useCopyPaymentDetails.ts";

export function PaymentMethodItem({ type, details }: { type: PaymentMethodType; details: string }) {
  const { t } = useLingui();
  const methodName = t(paymentMethodLabels[type]);
  const href = getPaymentLink(type, details);
  const copyDetails = useCopyPaymentDetails(details);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const heldRef = useRef(false);
  const suppressHeldClickRef = useRef(false);

  const { linkProps } = useLink(
    {
      href: href ?? undefined,
      target: "_blank",
      onPress: () => trackEvent("payment_link_requested"),
    },
    linkRef,
  );

  const { longPressProps } = useLongPress({
    accessibilityDescription: t`Hold to copy payment details`,
    onLongPressStart: () => {
      heldRef.current = false;
    },
    onLongPress: () => {
      heldRef.current = true;
      suppressHeldClickRef.current = true;
    },
  });

  const content = (
    <>
      <span className="bg-accent-100 text-accent-800 dark:bg-accent-800 dark:text-accent-100 flex size-11 shrink-0 items-center justify-center rounded-xl">
        <PaymentMethodIcon type={type} size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{methodName}</span>
        {href ? (
          <span className="text-accent-700 dark:text-accent-300 block truncate text-sm">
            {details}
          </span>
        ) : null}
      </span>
      <Icon
        icon={href ? "lucide.arrow-up-right" : "lucide.copy"}
        width={18}
        height={18}
        className="text-accent-500 dark:text-accent-400 shrink-0"
      />
    </>
  );

  const rowClassName =
    "flex min-h-20 w-full min-w-0 touch-pan-y items-center gap-3 rounded-xl p-4 text-left outline-hidden transition-colors hover:bg-accent-50 focus-visible:ring-2 focus-visible:ring-accent-500 active:bg-accent-100 dark:hover:bg-accent-800/60 dark:active:bg-accent-800 [-webkit-touch-callout:none] select-none";

  return (
    <section aria-label={methodName} className="group dark:bg-accent-900 rounded-xl bg-white">
      <div className="flex items-center">
        {href ? (
          <a
            {...mergeProps(linkProps, longPressProps)}
            ref={linkRef}
            onPointerDownCapture={() => {
              suppressHeldClickRef.current = false;
            }}
            onClickCapture={(event) => {
              // Cancelling usePress does not cancel every browser's native link click.
              // A new pointer down starts a fresh action; detail 0 keeps keyboard/AT activation.
              if (suppressHeldClickRef.current && event.detail > 0) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onPointerUpCapture={() => {
              // Keep clipboard access inside the release gesture on touch browsers.
              if (heldRef.current) {
                heldRef.current = false;
                void copyDetails();
              }
            }}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t({ message: `Open ${methodName}` })}
            className={rowClassName}
          >
            {content}
          </a>
        ) : (
          <Button
            onPress={() => void copyDetails()}
            aria-label={t({ message: `Copy ${methodName} details` })}
            className={rowClassName}
          >
            {content}
          </Button>
        )}
        {href ? (
          <IconButton
            icon="lucide.copy"
            aria-label={t({ message: `Copy ${methodName} details` })}
            pressAction={copyDetails}
            className="mr-3 size-11 shrink-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100"
          />
        ) : null}
      </div>
      {!href ? (
        <p className="text-accent-700 dark:text-accent-300 px-4 pb-4 text-sm wrap-anywhere whitespace-pre-wrap select-text">
          {details}
        </p>
      ) : null}
    </section>
  );
}
