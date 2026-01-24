import { t } from "@lingui/core/macro";
import {
  validateDocumentId as sdkValidateDocumentId,
  validatePartyTitle as sdkValidatePartyTitle,
  validatePartyDescription as sdkValidatePartyDescription,
  validateParticipantName as sdkValidateParticipantName,
  validatePhoneNumber as sdkValidatePhoneNumber,
  PARTY_TITLE_REQUIRED,
  PARTY_TITLE_TOO_LONG,
  PARTY_DESCRIPTION_TOO_LONG,
  PARTICIPANT_NAME_REQUIRED,
  PARTICIPANT_NAME_TOO_LONG,
  PHONE_NUMBER_TOO_LONG,
  DOCUMENT_ID_REQUIRED,
  DOCUMENT_ID_INVALID,
  type ValidationErrorKey,
} from "@trizum/sdk";

/**
 * Maps SDK validation error keys to translated messages.
 */
function getErrorMessage(errorKey: ValidationErrorKey): string {
  switch (errorKey) {
    case PARTY_TITLE_REQUIRED:
      return t`Title is required`;
    case PARTY_TITLE_TOO_LONG:
      return t`Title must be less than 50 characters`;
    case PARTY_DESCRIPTION_TOO_LONG:
      return t`Description must be less than 500 characters`;
    case PARTICIPANT_NAME_REQUIRED:
      return t`A name for the participant is required`;
    case PARTICIPANT_NAME_TOO_LONG:
      return t`Name must be less than 50 characters`;
    case PHONE_NUMBER_TOO_LONG:
      return t`Phone number must be less than 20 characters`;
    case DOCUMENT_ID_REQUIRED:
      return t`ID is required`;
    case DOCUMENT_ID_INVALID:
      return t`This isn't a valid ID`;
    default:
      return t`Invalid value`;
  }
}

/**
 * Wrap an SDK validator with i18n message translation.
 */
function wrapValidator(
  validator: (value: string) => string | null,
): (value: string) => string | null {
  return (value: string) => {
    const errorKey = validator(value);
    return errorKey ? getErrorMessage(errorKey as ValidationErrorKey) : null;
  };
}

export const validateDocumentId = wrapValidator(sdkValidateDocumentId);
export const validatePartyTitle = wrapValidator(sdkValidatePartyTitle);
export const validatePartyDescription = wrapValidator(
  sdkValidatePartyDescription,
);
export const validatePartyParticipantName = wrapValidator(
  sdkValidateParticipantName,
);
export const validateExpenseTitle = validatePartyTitle;
export const validatePhoneNumber = wrapValidator(sdkValidatePhoneNumber);
