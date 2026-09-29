CREATE TABLE `play_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`play_session_id` integer NOT NULL,
	`event_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`play_session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "play_events_sequence_check" CHECK("play_events"."sequence" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `play_events_session_event_uidx` ON `play_events` (`play_session_id`,`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `play_events_session_sequence_uidx` ON `play_events` (`play_session_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `play_events_session_occurred_idx` ON `play_events` (`play_session_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_key` text NOT NULL,
	`user_email` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` text NOT NULL,
	`case_fingerprint` text NOT NULL,
	`custom_case_id` integer,
	`state` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_event_at` text,
	`completed_at` text,
	`expires_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`custom_case_id`) REFERENCES `custom_cases`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "play_sessions_status_check" CHECK("play_sessions"."status" in ('active', 'completed', 'abandoned', 'expired')),
	CONSTRAINT "play_sessions_revision_check" CHECK("play_sessions"."revision" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `play_sessions_session_key_uidx` ON `play_sessions` (`session_key`);--> statement-breakpoint
CREATE INDEX `play_sessions_user_status_updated_idx` ON `play_sessions` (`user_email`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `play_sessions_case_version_idx` ON `play_sessions` (`case_id`,`case_version`,`case_fingerprint`,`started_at`);--> statement-breakpoint
CREATE INDEX `play_sessions_custom_case_idx` ON `play_sessions` (`custom_case_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `case_drafts_custom_version_fingerprint_idx` ON `case_drafts` (`custom_case_id`,`version`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `case_feedback_user_created_idx` ON `case_feedback` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `cases_status_title_idx` ON `cases` (`status`,`title`);--> statement-breakpoint
CREATE INDEX `update_reads_user_update_idx` ON `update_reads` (`user_email`,`update_id`);