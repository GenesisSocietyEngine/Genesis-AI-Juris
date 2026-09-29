CREATE TABLE `custom_case_grants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`custom_case_id` integer NOT NULL,
	`recipient_email` text NOT NULL,
	`granted_by_email` text NOT NULL,
	`can_reshare` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`custom_case_id`) REFERENCES `custom_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_case_grants_case_recipient_uidx` ON `custom_case_grants` (`custom_case_id`,`recipient_email`);--> statement-breakpoint
CREATE INDEX `custom_case_grants_recipient_idx` ON `custom_case_grants` (`recipient_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `custom_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`case_id` text NOT NULL,
	`title` text NOT NULL,
	`current_version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'custom' NOT NULL,
	`promoted_at` text,
	`promoted_by_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `custom_cases_owner_case_uidx` ON `custom_cases` (`owner_email`,`case_id`);--> statement-breakpoint
CREATE INDEX `custom_cases_visibility_idx` ON `custom_cases` (`is_private`,`status`,`updated_at`);--> statement-breakpoint
INSERT INTO `custom_cases` (`owner_email`,`case_id`,`title`,`current_version`,`fingerprint`,`is_private`,`status`,`created_at`,`updated_at`)
SELECT `draft`.`user_email`,`draft`.`case_id`,`draft`.`title`,`draft`.`version`,`draft`.`fingerprint`,false,
	CASE WHEN `draft`.`status` = 'published' THEN 'promoted' ELSE 'custom' END,
	`draft`.`created_at`,`draft`.`updated_at`
FROM `case_drafts` AS `draft`
WHERE NOT EXISTS (
	SELECT 1 FROM `case_drafts` AS `newer`
	WHERE `newer`.`user_email` = `draft`.`user_email`
		AND `newer`.`case_id` = `draft`.`case_id`
		AND (`newer`.`updated_at` > `draft`.`updated_at` OR (`newer`.`updated_at` = `draft`.`updated_at` AND `newer`.`id` > `draft`.`id`))
);--> statement-breakpoint
ALTER TABLE `case_drafts` ADD `custom_case_id` integer REFERENCES custom_cases(id);--> statement-breakpoint
UPDATE `case_drafts`
SET `custom_case_id` = (
	SELECT `custom_cases`.`id` FROM `custom_cases`
	WHERE `custom_cases`.`owner_email` = `case_drafts`.`user_email`
		AND `custom_cases`.`case_id` = `case_drafts`.`case_id`
);--> statement-breakpoint
CREATE INDEX `case_drafts_custom_case_idx` ON `case_drafts` (`custom_case_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `case_feedback` ADD `custom_case_id` integer REFERENCES custom_cases(id);--> statement-breakpoint
ALTER TABLE `case_feedback` ADD `audience` text DEFAULT 'central' NOT NULL;--> statement-breakpoint
CREATE INDEX `case_feedback_custom_case_idx` ON `case_feedback` (`custom_case_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `license_tier` text DEFAULT 'community' NOT NULL;
