CREATE TABLE `case_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`case_version` text NOT NULL,
	`user_email` text NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`studio_fingerprint` text,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `case_feedback_case_idx` ON `case_feedback` (`case_id`,`case_version`,`created_at`);--> statement-breakpoint
CREATE TABLE `case_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`case_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_subscriptions_user_case_uidx` ON `case_subscriptions` (`user_email`,`case_id`);--> statement-breakpoint
CREATE TABLE `case_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`parent_version` text,
	`change_summary` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_versions_case_version_uidx` ON `case_versions` (`case_id`,`version`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`current_version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`practice_area` text NOT NULL,
	`sector` text NOT NULL,
	`difficulty` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`review_level` text DEFAULT 'canonical' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`centrally_managed` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cases_classification_idx` ON `cases` (`jurisdiction`,`practice_area`,`difficulty`);--> statement-breakpoint
CREATE INDEX `cases_status_idx` ON `cases` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `update_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`update_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`update_id`) REFERENCES `updates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `update_reads_update_user_uidx` ON `update_reads` (`update_id`,`user_email`);--> statement-breakpoint
CREATE TABLE `updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'product' NOT NULL,
	`case_id` text,
	`target_jurisdictions` text DEFAULT '[]' NOT NULL,
	`target_practice_areas` text DEFAULT '[]' NOT NULL,
	`target_roles` text DEFAULT '[]' NOT NULL,
	`published_at` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `updates_published_idx` ON `updates` (`published_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`professional_role` text DEFAULT 'practitioner' NOT NULL,
	`organisation` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`practice_areas` text DEFAULT '[]' NOT NULL,
	`experience_level` text DEFAULT 'mid' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`product_updates` integer DEFAULT true NOT NULL,
	`case_updates` integer DEFAULT true NOT NULL,
	`research_invites` integer DEFAULT false NOT NULL,
	`verified_practitioner` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uidx` ON `users` (`email`);