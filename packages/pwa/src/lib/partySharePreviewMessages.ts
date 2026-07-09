import { msg } from "@lingui/core/macro";

export const partyShareFallbackDescriptionMessage = msg`Split bills with friends, family, and roommates.`;
export const partyShareFallbackNameMessage = msg`Shared expenses`;
export const partyShareImageFallbackDescriptionMessage = msg`Split expenses and settle up together on trizum.`;
export const partyShareJoinPartyMessage = msg`Join party`;
export const partyShareMetadataPurposeMessage = msg`Open this party to split expenses and settle up together on trizum.`;
export const partyShareViaMessage = msg`via`;

export function partyShareTitleMessage(partyName: string) {
  return msg`Join ${partyName} on trizum`;
}

export function partySharePreviewAltMessage(title: string) {
  return msg`${title} preview`;
}
