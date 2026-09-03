CREATE TABLE `studio_ai_leases` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_ai_leases_expiry_idx` ON `studio_ai_leases` (`expires_at`);