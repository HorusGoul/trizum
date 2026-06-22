import { t } from "@lingui/core/macro";

export interface AuthCallbackErrorContent {
  description: string;
  title: string;
}

export function getAuthCallbackErrorContent(error: string): AuthCallbackErrorContent {
  switch (normalizeAuthCallbackError(error)) {
    case "email_doesnt_match":
      return {
        title: t`Email addresses don't match`,
        description: t`To connect Google or Apple, choose an account with the same email address as your trizum cloud account.`,
      };
    case "invalid_token":
      return {
        title: t`Sign-in link expired`,
        description: t`This sign-in link is invalid or expired. Request a new link and try again.`,
      };
    default:
      return {
        title: t`Couldn't connect sign-in method`,
        description: t`trizum could not finish connecting that sign-in method. Please try again.`,
      };
  }
}

function normalizeAuthCallbackError(error: string) {
  return safelyDecodeURIComponent(error)
    .trim()
    .toLowerCase()
    .replaceAll("'", "")
    .replaceAll("’", "");
}

function safelyDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
