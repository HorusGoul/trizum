import {
  ExpenseListItemView,
  JoinedPartyView,
  ParticipantView,
  PartySummaryView,
} from "@trizum/data";

export const JOINED_PARTY_CONNECTION_VIEW = {
  items: {
    cursor: true,
    node: JoinedPartyView,
  },
  live: {
    append: "visible",
    prepend: "visible",
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
} as const;

export const PARTICIPANT_CONNECTION_VIEW = {
  items: {
    cursor: true,
    node: ParticipantView,
  },
  live: {
    append: "visible",
    prepend: "visible",
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
} as const;

export const PARTY_SUMMARY_CONNECTION_VIEW = {
  items: {
    cursor: true,
    node: PartySummaryView,
  },
  live: {
    append: "visible",
    prepend: "visible",
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
} as const;

export const EXPENSE_CONNECTION_VIEW = {
  args: {
    first: 50,
  },
  items: {
    cursor: true,
    node: ExpenseListItemView,
  },
  live: {
    prepend: "visible",
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
} as const;

export const ALL_EXPENSES_CONNECTION_VIEW = {
  args: {
    first: 10_000,
  },
  items: {
    cursor: true,
    node: ExpenseListItemView,
  },
  live: {
    prepend: "visible",
  },
  pagination: {
    hasNext: true,
    hasPrevious: true,
    nextCursor: true,
    previousCursor: true,
  },
} as const;
