import { msg, t } from "@lingui/core/macro";
import {
  paymentMethodTypes,
  type PaymentMethods,
  type PaymentMethodType,
} from "#src/models/paymentMethod.ts";
import { validatePhoneNumber } from "./validation.ts";

export const paymentMethodLabels = {
  bizum: msg`Bizum`,
  "bank-transfer": msg`Bank transfer`,
  paypal: msg`PayPal`,
  revolut: msg`Revolut`,
  venmo: msg`Venmo`,
  "cash-app": msg`Cash App`,
  other: msg`Other`,
};

export const paymentMethodDescriptions = {
  bizum: msg`Your Bizum phone number, including the country code.`,
  "bank-transfer": msg`Account holder, IBAN or account number, and any other details needed for a transfer.`,
  paypal: msg`Your PayPal.Me username or profile link.`,
  revolut: msg`Your Revtag or Revolut.me profile link. Enable Revtag discoverability in Revolut to receive payments.`,
  venmo: msg`Your Venmo username or profile link.`,
  "cash-app": msg`Your $Cashtag or Cash App profile link.`,
  other: msg`Describe how to pay you, including the service name and your payment details.`,
};

export const paymentMethodPlaceholders = {
  bizum: msg`+34 612 345 678`,
  "bank-transfer": msg`Account holder · IBAN or account number`,
  paypal: msg`PayPal.Me username or link`,
  revolut: msg`@revtag or Revolut.me link`,
  venmo: msg`@username or Venmo link`,
  "cash-app": msg`$Cashtag or Cash App link`,
  other: msg`Service name and payment details`,
};

const paymentProfiles = {
  paypal: { host: "paypal.me", prefix: "/", handle: /^[a-z0-9]{1,20}$/i },
  revolut: { host: "revolut.me", prefix: "/", handle: /^[a-z0-9][a-z0-9_.-]*$/i },
  venmo: { host: "venmo.com", prefix: "/u/", handle: /^[a-z0-9_-]+$/i },
  "cash-app": { host: "cash.app", prefix: "/$", handle: /^(?=.*[a-z])[a-z0-9]{1,20}$/i },
};

/** Only construct HTTPS profile links to the selected provider. Never link free text. */
export function getPaymentLink(type: PaymentMethodType, value: string): string | null {
  if (!(type in paymentProfiles)) return null;
  // SAFETY: The membership check narrows the selected method to a supported profile provider.
  const profile = paymentProfiles[type as keyof typeof paymentProfiles];
  let handle = value.trim();

  if (/^(?:www\.)?(?:paypal\.me|revolut\.me|venmo\.com|cash\.app)\//i.test(handle)) {
    handle = `https://${handle}`;
  }

  if (handle.includes(":") || handle.includes("/")) {
    let url: URL;

    try {
      url = new URL(handle);
    } catch {
      return null;
    }

    if (
      url.protocol !== "https:" ||
      (url.hostname !== profile.host && url.hostname !== `www.${profile.host}`) ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;

    if (!url.pathname.startsWith(profile.prefix)) return null;
    handle = url.pathname.slice(profile.prefix.length).replace(/\/$/, "");
  } else {
    handle = handle.replace(/^[@$]/, "");
  }

  if (!profile.handle.test(handle)) return null;

  return `https://${profile.host}${profile.prefix}${handle}`;
}

/** Missing methods means a legacy profile; an explicit empty map means all were removed. */
export function getPaymentMethods(source: {
  phone?: string;
  paymentMethods?: PaymentMethods;
}): PaymentMethods {
  return source.paymentMethods ?? (source.phone?.trim() ? { bizum: source.phone.trim() } : {});
}

export function normalizePaymentMethods(methods: PaymentMethods): PaymentMethods {
  const result: PaymentMethods = {};

  for (const type of paymentMethodTypes) {
    const value = methods[type]?.trim();

    if (value) result[type] = getPaymentLink(type, value) ?? value;
  }

  return result;
}

export function validatePaymentMethod(type: PaymentMethodType, value: string): string | null {
  if (!value.trim()) return t`Enter payment details or remove this method.`;

  if (value.length > 1000) return t`Payment details must be 1000 characters or fewer.`;

  if (type === "bizum") return validatePhoneNumber(value);

  if (type in paymentProfiles && !getPaymentLink(type, value)) {
    return t`Enter a valid username or a profile link for this payment service.`;
  }

  return null;
}
