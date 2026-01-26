import { t } from "@lingui/core/macro";
import { isValidDocumentId } from "@automerge/automerge-repo/slim";
import EMOJI_REGEX from "emojibase-regex/emoji";

export function validateDocumentId(id: string) {
  id = id.trim();

  if (!id) {
    return t`ID is required`;
  }

  if (!isValidDocumentId(id)) {
    return t`This isn't a valid ID`;
  }

  return null;
}

export function validatePartyTitle(title: string) {
  title = title.trim();

  if (!title) {
    return t`Title is required`;
  }

  if (title.length > 50) {
    return t`Title must be less than 50 characters`;
  }

  return null;
}

export function isEmojiOnly(str: string): boolean {
  return str.match(EMOJI_REGEX) !== null;
}

export function validatePartySymbol(symbol: string) {
  if (!isEmojiOnly(symbol)) {
    return t`Symbol must contain only emojis`;
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = Array.from(segmenter.segment(symbol));

  if (segments.length > 1) {
    return t`Symbol must be only one emoji`;
  }

  return null;
}

export function validatePartyDescription(description: string) {
  description = description.trim();

  if (description.length > 500) {
    return t`Description must be less than 500 characters`;
  }

  return null;
}

export function validatePartyParticipantName(name: string) {
  name = name.trim();

  if (!name) {
    return t`A name for the participant is required`;
  }

  if (name.length > 50) {
    return t`Name must be less than 50 characters`;
  }

  return null;
}

export const validateExpenseTitle = validatePartyTitle;

export function validatePhoneNumber(phone: string) {
  phone = phone.trim();

  if (phone.length > 20) {
    return t`Phone number must be less than 20 characters`;
  }

  // TODO: libphonenumber-js maybe?

  return null;
}
