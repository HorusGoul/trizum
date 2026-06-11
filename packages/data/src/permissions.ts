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
          ownerUserId: session.userId,
        }),
        policy.partyMembers.exists.where({
          partyId,
          userId: session.userId,
        }),
      ]);
    const partyEditor = (partyId: PermissionValue) =>
      anyOf([
        policy.parties.exists.where({
          id: partyId,
          ownerUserId: session.userId,
        }),
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

      policy.participants.allowRead.where((participant) => partyReader(participant.partyId)),
      policy.participants.allowInsert.where((participant) => partyEditor(participant.partyId)),
      policy.participants.allowUpdate
        .whereOld((participant) => partyReader(participant.partyId))
        .whereNew((participant) => partyReader(participant.partyId)),
      policy.participants.allowDelete.where((participant) => partyEditor(participant.partyId)),

      policy.mediaFiles.allowRead.where((mediaFile) =>
        anyOf([{ ownerUserId: session.userId }, partyReader(mediaFile.partyId)]),
      ),
      policy.mediaFiles.allowInsert.where({ ownerUserId: session.userId }),
      policy.mediaFiles.allowUpdate
        .whereOld({ ownerUserId: session.userId })
        .whereNew({ ownerUserId: session.userId }),
      policy.mediaFiles.allowDelete.where({ ownerUserId: session.userId }),

      policy.expenses.allowRead.where((expense) => partyReader(expense.partyId)),
      policy.expenses.allowInsert.where((expense) => partyEditor(expense.partyId)),
      policy.expenses.allowUpdate
        .whereOld((expense) => partyReader(expense.partyId))
        .whereNew((expense) => partyEditor(expense.partyId)),
      policy.expenses.allowDelete.where((expense) => partyEditor(expense.partyId)),
    ];
  },
);

export const permissions = trizumJazzPermissions;
export default trizumJazzPermissions;
