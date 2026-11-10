import type { IconProps } from "@trizum/ui/Icon";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";

export const paymentMethodIcons = {
  bizum: "brand.bizum",
  "bank-transfer": "lucide.landmark",
  paypal: "brand.paypal",
  revolut: "brand.revolut",
  venmo: "brand.venmo",
  "cash-app": "brand.cash-app",
  other: "lucide.wallet",
} satisfies Record<PaymentMethodType, IconProps["icon"]>;
