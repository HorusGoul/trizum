import { schema as s } from "jazz-tools";

export default s.defineMigration({
  migrate: {
    expenses: {
      updatedAt: s.add.timestamp({ default: null }),
    },
  },
  fromHash: "2261d303fb3a",
  toHash: "7b2043c50a08",
  from: {
    expenses: s.table({
      partyId: s.ref("parties"),
      name: s.string(),
      paidAt: s.timestamp(),
      amount: s.int(),
      paidBy: s.json(),
      shares: s.json(),
      photos: s.array(s.string()),
      isTransfer: s.boolean(),
      internalMemo: s.string().optional(),
      hash: s.string().optional(),
      editCopy: s.json().optional(),
      editCopyLastUpdatedAt: s.timestamp().optional(),
    }),
  },
  to: {
    expenses: s.table({
      partyId: s.ref("parties"),
      name: s.string(),
      paidAt: s.timestamp(),
      amount: s.int(),
      paidBy: s.json(),
      shares: s.json(),
      photos: s.array(s.string()),
      isTransfer: s.boolean(),
      internalMemo: s.string().optional(),
      hash: s.string().optional(),
      editCopy: s.json().optional(),
      editCopyLastUpdatedAt: s.timestamp().optional(),
      updatedAt: s.timestamp().optional(),
    }),
  },
});
