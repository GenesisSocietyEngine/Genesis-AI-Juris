CREATE TABLE `portal_upload_disposals` (
	`upload_id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `portal_upload_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text NOT NULL,
	`basis` text NOT NULL,
	`owner` text NOT NULL,
	`review_on` text NOT NULL,
	`placed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`released_at` text
);
--> statement-breakpoint
CREATE INDEX `portal_holds_by_upload` ON `portal_upload_holds` (`upload_id`,`released_at`);--> statement-breakpoint
CREATE TABLE `portal_upload_transfers` (
	`upload_id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `dossier_document_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER portal_retired_id BEFORE INSERT ON portal_uploads
WHEN EXISTS (SELECT 1 FROM portal_upload_disposals WHERE upload_id=NEW.id)
BEGIN SELECT RAISE(IGNORE); END;
--> statement-breakpoint
CREATE TRIGGER portal_disposal_claim AFTER INSERT ON portal_upload_disposals
BEGIN DELETE FROM portal_uploads WHERE id=NEW.upload_id AND grant_id=NEW.grant_id; END;
