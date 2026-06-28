import { t } from "@lingui/core/macro";
import { extractTricountId } from "#src/lib/tricount.ts";

export function validateTricountKey(value: string) {
  if (!value) {
    return t`Tricount key or URL is required`;
  }

  const extractedId = extractTricountId(value);
  if (!extractedId) {
    return t`Please paste the Tricount sharing message, URL (e.g., https://tricount.com/abc123), or key`;
  }

  return undefined;
}
