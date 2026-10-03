/** Approved names and meanings. No event accepts caller-supplied properties. */
export const analyticsEvents = {
  party_created: "A group document was created through the new-group form.",
  party_joined: "The user selected their participant when joining a group.",
  party_left: "A group was removed from the user's group list.",
  party_pinned: "A group was pinned on the home screen.",
  party_unpinned: "A group was unpinned on the home screen.",
  party_archived: "A group was archived from the home screen.",
  party_restored: "An archived group was restored to the home screen.",
  party_details_updated: "The group details form was saved.",
  party_participants_updated:
    "Participant additions, edits, removals or archives were saved as a batch.",
  party_participant_switched: "The user switched their participant in a group they already joined.",
  party_share_requested: "The user requested the system share flow; delivery is not confirmed.",
  party_link_copied: "The group invite link was written to the clipboard.",
  party_expenses_selected: "The user switched to the expenses tab; direct visits are pageviews.",
  party_balances_selected: "The user switched to the balances tab; direct visits are pageviews.",
  personal_mode_enabled: "Personal mode was enabled for the current participant.",
  personal_mode_disabled: "Personal mode was disabled for the current participant.",
  balances_sort_changed: "The user changed the balance sorting preference.",
  balances_recalculated: "A user-requested balance recalculation completed.",
  expense_created: "An expense was successfully added through the expense editor.",
  expense_updated: "An expense edit was saved.",
  expense_deleted: "An expense was successfully removed.",
  expense_template_used:
    "An expense was saved using a valid template selected when opening the editor.",
  expense_template_created: "A new expense template was saved.",
  expense_template_updated: "An existing expense template was saved.",
  expense_template_deleted: "An expense template deletion was confirmed and applied.",
  expense_template_default_changed: "The group's default expense template was changed.",
  expense_template_shortcut_enabled: "The participant enabled skipping the template picker.",
  expense_template_shortcut_disabled: "The participant disabled skipping the template picker.",
  custom_templates_only_enabled:
    "The group enabled custom templates only, after confirmation if needed.",
  custom_templates_only_disabled: "The group disabled custom templates only.",
  settlement_recorded:
    "A debt payment was recorded, not confirmation of an external money transfer.",
  payment_contact_copied:
    "A Bizum payment contact was copied; neither the contact nor a payment confirmation is sent.",
  debt_transferred: "Both sides of a debt transfer between groups were successfully recorded.",
  tricount_import_started: "The user started a Tricount import.",
  tricount_import_completed: "A Tricount import created the destination group.",
  tricount_import_failed: "A Tricount import failed; no error details are sent.",
  settings_saved: "The profile and app settings form was saved; no field values are sent.",
  avatar_selected: "An avatar image was prepared and selected in the settings draft.",
  avatar_removed: "An avatar was removed from the settings draft.",
  calculator_opened:
    "The calculator was opened manually or by auto-open, not refocused while open.",
  calculator_auto_open_enabled: "Auto-open was enabled from the expense editor shortcut.",
  calculator_auto_open_disabled: "Auto-open was disabled from the expense editor shortcut.",
  receipt_attachments_added:
    "One batch of receipt attachments was prepared and added to the expense draft.",
  receipt_attachment_removed: "A receipt attachment was removed from the expense draft.",
  receipt_gallery_opened:
    "The receipt gallery was opened; changing slides does not emit another event.",
  join_qr_scanned: "A validated group QR code was received; joining is recorded separately.",
  auth_magic_link_requested:
    "The server accepted a sign-in email request; delivery/sign-in is not confirmed.",
  auth_signed_in:
    "An in-app password or native social sign-in returned a user; excludes redirect callbacks.",
  auth_social_sign_in_requested:
    "The user requested social sign-in; redirects are not successful sign-ins.",
  auth_account_link_requested:
    "The user requested linking a social account; redirect completion is not inferred.",
  auth_password_reset_requested: "The server accepted a password email request.",
  auth_password_reset_completed: "A token-based password update succeeded.",
  auth_signed_out: "The sign-out request succeeded.",
  auth_account_deleted: "The account deletion request succeeded.",
  cloud_sync_activated:
    "The user activated a different cloud group list, with analytics enabled on both lists.",
  premium_paywall_opened:
    "A new paywall session was opened; repeated requests for the same session are ignored.",
  premium_purchase_started: "A user-initiated purchase was sent to the store integration.",
  premium_purchase_completed:
    "The store purchase returned successfully, even if entitlement sync is pending.",
  premium_purchase_cancelled: "The store reported a user-cancelled purchase.",
  premium_purchase_failed: "The purchase failed; no error or transaction data is sent.",
  premium_restore_started: "The user requested restoring purchases.",
  premium_restore_completed: "A restore returned an active Premium entitlement.",
  premium_restore_empty: "A restore returned without an active Premium entitlement.",
  premium_restore_failed: "A restore request failed.",
  premium_customer_center_requested:
    "The user requested subscription management; no account data is sent.",
  premium_redemption_requested:
    "The user requested the native redemption flow or followed a store redemption link.",
  premium_code_copied: "A redemption code was copied; the code itself is never sent.",
  party_boost_applied:
    "A user-requested boost activation or transfer succeeded; excludes background refreshes.",
  premium_banner_dismissed: "The user dismissed the Premium home banner.",
} as const;

export type AnalyticsEvent = keyof typeof analyticsEvents;
