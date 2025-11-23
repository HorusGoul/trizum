CREATE TABLE `automerge_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` blob NOT NULL,
	`is_document` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
