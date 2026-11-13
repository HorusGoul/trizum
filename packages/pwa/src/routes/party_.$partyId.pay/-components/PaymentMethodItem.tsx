import { Trans, useLingui } from "@lingui/react/macro";
import { mergeProps, useButton, useLink, useLongPress } from "react-aria";
import { useId, useRef, type KeyboardEvent } from "react";
import { trackEvent } from "#src/lib/analytics.ts";
import { getPaymentHandle, getPaymentLink, paymentMethodLabels } from "#src/lib/paymentMethods.ts";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";
import { PaymentMethodIcon } from "#src/components/PaymentMethodIcon.tsx";
import { useCopyPaymentDetails } from "#src/hooks/useCopyPaymentDetails.ts";

export function PaymentMethodItem({ type, details }: { type: PaymentMethodType; details: string }) {
  const { t } = useLingui();
  const methodName = t(paymentMethodLabels[type]);
  const href = getPaymentLink(type, details);
  const displayDetails = getPaymentHandle(type, details) ?? details;
  const copyDetails = useCopyPaymentDetails(displayDetails);
  const descriptionId = useId();
  const showInstructions = !href && type !== "bizum";
  const linkRef = useRef<HTMLAnchorElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  const { buttonProps } = useButton(
    {
      onPress: (event) => {
        if (
          type === "bizum" ||
          event.pointerType === "keyboard" ||
          event.pointerType === "virtual"
        ) {
          void copyDetails();
        }
      },
    },
    buttonRef,
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

  const description = href
    ? t({ message: `Tap to open ${methodName} and pay.` })
    : type === "bizum"
      ? t`Tap to copy the phone number and pay through Bizum using your bank app.`
      : type === "bank-transfer"
        ? t`Use these bank details to make a transfer.`
        : t`Follow these instructions to arrange payment.`;

  const valueId = `${descriptionId}-value`;
  const keyboardHintId = `${descriptionId}-keyboard`;
  const describedBy = `${valueId} ${descriptionId} ${keyboardHintId}`;

  function copyAfterHold() {
    // Keep clipboard access inside the release gesture on touch browsers.
    if (heldRef.current) {
      heldRef.current = false;
      void copyDetails();
    }
  }

  function copyWithKeyboard(event: KeyboardEvent<HTMLElement>) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "c") {
      if (event.currentTarget.ownerDocument.getSelection()?.isCollapsed === false) return;
      event.preventDefault();
      void copyDetails();
    }
  }

  const content = (
    <>
      <span className="text-accent-700 dark:text-accent-200 mt-1 w-5 shrink-0">
        <PaymentMethodIcon type={type} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{methodName}</span>
        <span
          id={valueId}
          className={`text-accent-800 dark:text-accent-100 mt-1 block text-base ${showInstructions ? "wrap-anywhere whitespace-pre-wrap select-text" : "truncate"}`}
        >
          {displayDetails}
        </span>
        <span
          id={descriptionId}
          className="text-accent-600 dark:text-accent-400 mt-1 block text-sm"
        >
          {description}
        </span>
        <span id={keyboardHintId} className="sr-only">
          <Trans>On a keyboard, press Ctrl+C or Command+C to copy.</Trans>
        </span>
      </span>
    </>
  );

  const rowClassName =
    "flex w-full min-w-0 cursor-pointer touch-pan-y items-start gap-3 rounded-[inherit] bg-transparent px-4 py-3 text-left outline-hidden transition-colors hover:bg-accent-50 dark:hover:bg-accent-800/60 [-webkit-touch-callout:none] select-none";

  return (
    <section
      aria-label={methodName}
      className="group dark:bg-accent-900 focus-within:ring-accent-400 relative bg-white first:rounded-t-xl last:rounded-b-xl focus-within:z-10 focus-within:ring-2 focus-within:ring-inset"
    >
      {href ? (
        <a
          {...mergeProps(linkProps, longPressProps, {
            "aria-describedby": describedBy,
            onKeyDown: copyWithKeyboard,
          })}
          ref={linkRef}
          onPointerDownCapture={() => {
            suppressHeldClickRef.current = false;
          }}
          onClickCapture={(event) => {
            // A held pointer must not navigate when the browser sends a late click.
            // Detail 0 keeps ordinary keyboard and assistive activation available.
            if (suppressHeldClickRef.current && event.detail > 0) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onPointerUpCapture={copyAfterHold}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t({ message: `Open ${methodName}` })}
          className={rowClassName}
        >
          {content}
        </a>
      ) : (
        <button
          {...mergeProps(buttonProps, longPressProps, {
            "aria-describedby": describedBy,
            onKeyDown: copyWithKeyboard,
          })}
          type="button"
          ref={buttonRef}
          onClickCapture={(event) => {
            if (suppressHeldClickRef.current && event.detail > 0) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onPointerDownCapture={() => {
            suppressHeldClickRef.current = false;
          }}
          onPointerUpCapture={copyAfterHold}
          aria-label={t({ message: `Copy ${methodName} details` })}
          className={rowClassName}
        >
          {content}
        </button>
      )}
    </section>
  );
}
