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
  bizum: msg`Your Bizum phone number.`,
  "bank-transfer": msg`Account holder, IBAN or account number, and any other details needed for a transfer.`,
  paypal: msg`Your PayPal.Me username or profile link.`,
  revolut: msg`Your Revtag or Revolut.me profile link. Enable Revtag discoverability in Revolut to receive payments.`,
  venmo: msg`Your Venmo username or profile link.`,
  "cash-app": msg`Your $Cashtag or Cash App profile link.`,
  other: msg`Describe how to pay you, including the service name and your payment details.`,
};

export const paymentMethodPlaceholders = {
  bizum: msg`e.g. 612 345 678`,
  "bank-transfer": msg`e.g. Alex · IBAN or account number`,
  paypal: msg`e.g. paypal.me/yourname`,
  revolut: msg`e.g. @yourname`,
  venmo: msg`e.g. @yourname`,
  "cash-app": msg`e.g. $yourname`,
  other: msg`e.g. Wise · your payment details`,
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

/** Profile handles shown and copied on Pay; full provider URLs remain the navigation target. */
export function getPaymentHandle(type: PaymentMethodType, value: string): string | null {
  const href = getPaymentLink(type, value);

  if (!href) return null;

  const path = new URL(href).pathname;

  return type === "cash-app" ? path.slice(1) : `@${path.slice(path.lastIndexOf("/") + 1)}`;
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

const invalidProfileMessages = {
  paypal: msg`Enter a valid PayPal.Me username or profile link.`,
  revolut: msg`Enter a valid Revtag or Revolut.me profile link.`,
  venmo: msg`Enter a valid Venmo username or profile link.`,
  "cash-app": msg`Enter a valid $Cashtag or Cash App profile link.`,
};

export function validatePaymentMethod(type: PaymentMethodType, value: string): string | null {
  const details = value.trim();

  // Blank drafts are removed by normalizePaymentMethods when settings are saved.
  if (!details) return null;

  if (type === "bizum") {
    if (validatePhoneNumber(details)) {
      return t`The Bizum phone number must be 20 characters or fewer.`;
    }

    const digits = details.replace(/\D/g, "");

    if (!/^\+?[\d\s().-]+$/.test(details) || digits.length < 6 || digits.length > 15) {
      return t`Enter a valid Bizum phone number.`;
    }

    return null;
  }

  if (value.length > 1000) {
    const methodName = t(paymentMethodLabels[type]);

    return t`${methodName} details must be 1000 characters or fewer.`;
  }

  if (type in paymentProfiles && !getPaymentLink(type, details)) {
    // SAFETY: Profile providers and their validation messages share the same keys.
    return t(invalidProfileMessages[type as keyof typeof invalidProfileMessages]);
  }

  return null;
}
