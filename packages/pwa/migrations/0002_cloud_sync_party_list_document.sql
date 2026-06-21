drop table "cloud_user_settings";

create table "cloud_user_settings" (
  "userId" text not null primary key references "user" ("id") on delete cascade,
  "partyListDocumentId" text not null,
  "updatedAt" integer not null
);
