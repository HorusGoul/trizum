import { t } from "@lingui/core/macro";
import { toast } from "sonner";

export function checkRedemptionConnection() {
  if (navigator.onLine) return true;
  toast.error(t`Connect to the internet to redeem your code. Your code will stay here.`);
  return false;
}
