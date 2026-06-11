import { definePermissions } from "jazz-tools";

import { trizumJazzApp } from "./schema.js";

type PermissionRowRef = {
  readonly __jazzPermissionKind: "row-ref";
  readonly column: string;
};

type PermissionValue = PermissionRowRef | string;

export const trizumJazzPermissions = definePermissions(
  trizumJazzApp,
  ({ allowedTo, anyOf, policy, session }) => {
    const partyReader = (partyId: PermissionValue) =>
      anyOf([
        policy.parties.exists.where({
          id: partyId,
          ownerUserId: session.user_id,
        }),
        policy.partyMembers.exists.where({
          partyId,
          userId: session.user_id,
        }),
      ]);
    const partyEditor = (partyId: PermissionValue) =>
      anyOf([
        policy.parties.exists.where({
          id: partyId,
          ownerUserId: session.user_id,
        }),
        policy.partyMembers.exists.where({
          partyId,
          role: "owner",
          userId: session.user_id,
        }),
        policy.partyMembers.exists.where({
          partyId,
          role: "editor",
          userId: session.user_id,
        }),
      ]);

    return [
      policy.users.allowRead.where({ $createdBy: session.user_id }),
      policy.users.allowInsert.where({ $createdBy: session.user_id }),
      policy.users.allowUpdate
        .whereOld({ $createdBy: session.user_id })
        .whereNew({ $createdBy: session.user_id }),
      policy.users.allowDelete.where({ $createdBy: session.user_id }),

      policy.parties.allowRead.where((party) =>
        anyOf([
          { ownerUserId: session.user_id },
          { localOnlyInviteSecret: { ne: null } },
          policy.partyMembers.exists.where({
            partyId: party.id,
            userId: session.user_id,
          }),
        ]),
      ),
      policy.parties.allowInsert.where({ ownerUserId: session.user_id }),
      policy.parties.allowUpdate.where((party) =>
        anyOf([{ ownerUserId: session.user_id }, partyEditor(party.id)]),
      ),
      policy.parties.allowDelete.where({ ownerUserId: session.user_id }),

      policy.partyMembers.allowRead.where(
        anyOf([{ userId: session.user_id }, allowedTo.update("partyId")]),
      ),
      policy.partyMembers.allowInsert.where(
        anyOf([allowedTo.update("partyId"), { role: "editor", userId: session.user_id }]),
      ),
      policy.partyMembers.allowUpdate
        .whereOld(anyOf([allowedTo.update("partyId"), { role: "editor", userId: session.user_id }]))
        .whereNew(
          anyOf([allowedTo.update("partyId"), { role: "editor", userId: session.user_id }]),
        ),
      policy.partyMembers.allowDelete.where(allowedTo.update("partyId")),

      policy.joinedParties.allowRead.where({ $createdBy: session.user_id }),
      policy.joinedParties.allowInsert.where({ $createdBy: session.user_id }),
      policy.joinedParties.allowUpdate
        .whereOld({ $createdBy: session.user_id })
        .whereNew({ $createdBy: session.user_id }),
      policy.joinedParties.allowDelete.where({ $createdBy: session.user_id }),

      policy.participants.allowRead.where(allowedTo.read("partyId")),
      policy.participants.allowInsert.where(allowedTo.update("partyId")),
      policy.participants.allowUpdate
        .whereOld(allowedTo.update("partyId"))
        .whereNew(allowedTo.update("partyId")),
      policy.participants.allowDelete.where(allowedTo.update("partyId")),

      policy.mediaFiles.allowRead.where((mediaFile) =>
        anyOf([{ ownerUserId: session.user_id }, partyReader(mediaFile.partyId)]),
      ),
      policy.mediaFiles.allowInsert.where({ ownerUserId: session.user_id }),
      policy.mediaFiles.allowUpdate
        .whereOld({ ownerUserId: session.user_id })
        .whereNew({ ownerUserId: session.user_id }),
      policy.mediaFiles.allowDelete.where({ ownerUserId: session.user_id }),

      policy.expenses.allowRead.where((expense) => partyReader(expense.partyId)),
      policy.expenses.allowInsert.where(allowedTo.update("partyId")),
      policy.expenses.allowUpdate
        .whereOld(allowedTo.update("partyId"))
        .whereNew(allowedTo.update("partyId")),
      policy.expenses.allowDelete.where(allowedTo.update("partyId")),
    ];
  },
);

export const permissions = trizumJazzPermissions;
export default trizumJazzPermissions;
