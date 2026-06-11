import { definePermissions } from "jazz-tools";

import { trizumJazzApp } from "./schema.js";

type PermissionRowRef = {
  readonly __jazzPermissionKind: "row-ref";
  readonly column: string;
};

type PermissionValue = PermissionRowRef | string;

export const trizumJazzPermissions = definePermissions(
  trizumJazzApp,
  ({ allowedTo, allOf, anyOf, policy, session }) => {
    const partyOwner = (partyId: PermissionValue) =>
      policy.parties.exists.where({
        id: partyId,
        ownerUserId: session.userId,
      });
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
    const partyWriter = (partyId: PermissionValue) =>
      anyOf([partyOwner(partyId), partyEditor(partyId)]);

    function partyWriterOfRow(column: "partyId") {
      return partyWriter({
        __jazzPermissionKind: "row-ref",
        column,
      });
    }

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
        anyOf([{ userId: session.userId }, partyWriterOfRow("partyId")]),
      ),
      policy.partyMembers.allowInsert.where(
        anyOf([
          partyWriterOfRow("partyId"),
          allOf([allowedTo.read("partyId"), { role: "editor", userId: session.userId }]),
        ]),
      ),
      policy.partyMembers.allowUpdate
        .whereOld((member) => partyWriter(member.partyId))
        .whereNew((member) => partyWriter(member.partyId)),
      policy.partyMembers.allowDelete.where((member) => partyWriter(member.partyId)),

      policy.joinedParties.allowRead.where({ $createdBy: session.userId }),
      policy.joinedParties.allowInsert.where({ $createdBy: session.userId }),
      policy.joinedParties.allowUpdate
        .whereOld({ $createdBy: session.userId })
        .whereNew({ $createdBy: session.userId }),
      policy.joinedParties.allowDelete.where({ $createdBy: session.userId }),

      policy.participants.allowRead.where(allowedTo.read("partyId")),
      policy.participants.allowInsert.where((participant) => partyWriter(participant.partyId)),
      policy.participants.allowUpdate
        .whereOld((participant) => partyWriter(participant.partyId))
        .whereNew((participant) => partyWriter(participant.partyId)),
      policy.participants.allowDelete.where((participant) => partyWriter(participant.partyId)),

      policy.mediaFiles.allowRead.where(
        anyOf([{ ownerUserId: session.userId }, allowedTo.read("partyId")]),
      ),
      policy.mediaFiles.allowInsert.where({ ownerUserId: session.userId }),
      policy.mediaFiles.allowUpdate
        .whereOld({ ownerUserId: session.userId })
        .whereNew({ ownerUserId: session.userId }),
      policy.mediaFiles.allowDelete.where({ ownerUserId: session.userId }),

      policy.expenses.allowRead.where(allowedTo.read("partyId")),
      policy.expenses.allowInsert.where((expense) => partyWriter(expense.partyId)),
      policy.expenses.allowUpdate
        .whereOld((expense) => partyWriter(expense.partyId))
        .whereNew((expense) => partyWriter(expense.partyId)),
      policy.expenses.allowDelete.where((expense) => partyWriter(expense.partyId)),
    ];
  },
);

export const permissions = trizumJazzPermissions;
export default trizumJazzPermissions;
