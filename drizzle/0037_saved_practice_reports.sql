CREATE TABLE `saved_practice_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`actor_ref` text NOT NULL,
	`name` text NOT NULL,
	`config` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `saved_reports_owner` ON `saved_practice_reports` (`organization_id`,`actor_ref`);
