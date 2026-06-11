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
    const partyEditor = (partyId: PermissionValue) =>
      anyOf([
        policy.partyMembers.exists.where({
          partyId,
          role: "owner",
          userId: session.userId,
        }),
        policy.partyMembers.exists.where({
          partyId,
          role: "editor",
          userId: session.userId,
        }),
      ]);

    return [
      policy.users.allowRead.where({ $createdBy: session.userId }),
      policy.users.allowInsert.where({ $createdBy: session.userId }),
      policy.users.allowUpdate
        .whereOld({ $createdBy: session.userId })
        .whereNew({ $createdBy: session.userId }),
      policy.users.allowDelete.where({ $createdBy: session.userId }),

      policy.parties.allowRead.where((party) =>
        anyOf([
          { ownerUserId: session.userId },
          { localOnlyInviteSecret: { isNull: false } },
          policy.partyMembers.exists.where({
            partyId: party.id,
            userId: session.userId,
          }),
        ]),
      ),
      policy.parties.allowInsert.where({ ownerUserId: session.userId }),
      policy.parties.allowUpdate
        .whereOld((party) => anyOf([{ ownerUserId: session.userId }, partyEditor(party.id)]))
        .whereNew((party) => anyOf([{ ownerUserId: session.userId }, partyEditor(party.id)])),
      policy.parties.allowDelete.where({ ownerUserId: session.userId }),

      policy.partyMembers.allowRead.where(
        anyOf([{ userId: session.userId }, allowedTo.update("partyId")]),
      ),
      policy.partyMembers.allowInsert.where(
        anyOf([allowedTo.update("partyId"), { role: "editor", userId: session.userId }]),
      ),
      policy.partyMembers.allowUpdate
        .whereOld(allowedTo.update("partyId"))
        .whereNew(allowedTo.update("partyId")),
      policy.partyMembers.allowDelete.where(allowedTo.update("partyId")),

      policy.joinedParties.allowRead.where({ $createdBy: session.userId }),
      policy.joinedParties.allowInsert.where({ $createdBy: session.userId }),
      policy.joinedParties.allowUpdate
        .whereOld({ $createdBy: session.userId })
        .whereNew({ $createdBy: session.userId }),
      policy.joinedParties.allowDelete.where({ $createdBy: session.userId }),

      policy.participants.allowRead.where(allowedTo.read("partyId")),
      policy.participants.allowInsert.where(allowedTo.update("partyId")),
      policy.participants.allowUpdate
        .whereOld(allowedTo.update("partyId"))
        .whereNew(allowedTo.update("partyId")),
      policy.participants.allowDelete.where(allowedTo.update("partyId")),

      policy.mediaFiles.allowRead.where(
        anyOf([{ ownerUserId: session.userId }, allowedTo.read("partyId")]),
      ),
      policy.mediaFiles.allowInsert.where({ ownerUserId: session.userId }),
      policy.mediaFiles.allowUpdate
        .whereOld({ ownerUserId: session.userId })
        .whereNew({ ownerUserId: session.userId }),
      policy.mediaFiles.allowDelete.where({ ownerUserId: session.userId }),

      policy.expenses.allowRead.where(allowedTo.read("partyId")),
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
