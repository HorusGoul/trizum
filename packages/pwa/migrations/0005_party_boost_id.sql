create table "party_boost_with_id" (
  "boostId" text not null primary key default (lower(hex(randomblob(16)))),
  "ownerUserId" text not null unique references "user" ("id") on delete cascade,
  "partyDocumentId" text not null,
  "assignedAt" integer not null,
  "transferableAt" integer not null,
  "revokedAt" integer,
  "revocationReason" text,
  "updatedAt" integer not null,
  "version" integer not null default 0
);

insert into "party_boost_with_id"
  ("boostId", "ownerUserId", "partyDocumentId", "assignedAt", "transferableAt", "revokedAt", "revocationReason", "updatedAt", "version")
select lower(hex(randomblob(16))), "ownerUserId", "partyDocumentId", "assignedAt", "transferableAt", "revokedAt", "revocationReason", "updatedAt", "version"
from "party_boost";

drop table "party_boost";
alter table "party_boost_with_id" rename to "party_boost";

create unique index "party_boost_active_partyDocumentId_unique"
  on "party_boost" ("partyDocumentId")
  where "revokedAt" is null;
