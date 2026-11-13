import { Icon } from "@trizum/ui/Icon";
import { paymentMethodIcons } from "#src/lib/paymentMethodIcons.ts";
import type { PaymentMethodType } from "#src/models/paymentMethod.ts";

export function PaymentMethodIcon({ type, size = 24 }: { type: PaymentMethodType; size?: number }) {
  return <Icon icon={paymentMethodIcons[type]} width={size} height={size} className="shrink-0" />;
}
