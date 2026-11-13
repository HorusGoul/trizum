export const paymentMethodTypes = [
  "bizum",
  "bank-transfer",
  "paypal",
  "revolut",
  "venmo",
  "cash-app",
  "other",
] as const;

export type PaymentMethodType = (typeof paymentMethodTypes)[number];

/** Optional receiving details, shared with participants in the user's groups. */
export type PaymentMethods = Partial<Record<PaymentMethodType, string>>;
