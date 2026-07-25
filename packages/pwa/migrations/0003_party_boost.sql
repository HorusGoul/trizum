create table "party_boost" (
  "ownerUserId" text not null primary key references "user" ("id") on delete cascade,
  "partyDocumentId" text not null,
  "assignedAt" integer not null,
  "transferableAt" integer not null,
  "updatedAt" integer not null
);

create unique index "party_boost_partyDocumentId_unique"
  on "party_boost" ("partyDocumentId");
