alter table "party_boost" add column "revokedAt" integer;
alter table "party_boost" add column "revocationReason" text;
alter table "party_boost" add column "version" integer not null default 0;

drop index "party_boost_partyDocumentId_unique";

create unique index "party_boost_active_partyDocumentId_unique"
  on "party_boost" ("partyDocumentId")
  where "revokedAt" is null;
