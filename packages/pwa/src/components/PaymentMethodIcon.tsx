import { Icon, type IconProps } from "@trizum/ui/Icon";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";

const paymentMethodIcons = {
  bizum: "brand.bizum",
  "bank-transfer": "lucide.landmark",
  paypal: "brand.paypal",
  revolut: "brand.revolut",
  venmo: "brand.venmo",
  "cash-app": "brand.cash-app",
  other: "lucide.wallet",
} satisfies Record<PaymentMethodType, IconProps["icon"]>;

export function PaymentMethodIcon({ type, size = 24 }: { type: PaymentMethodType; size?: number }) {
  return <Icon icon={paymentMethodIcons[type]} width={size} height={size} className="shrink-0" />;
}
