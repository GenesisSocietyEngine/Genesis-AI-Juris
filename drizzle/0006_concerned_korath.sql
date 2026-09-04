CREATE TABLE `account_recovery_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`code_hash` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `local_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_recovery_codes_hash_uidx` ON `account_recovery_codes` (`code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_recovery_codes_active_account_uidx` ON `account_recovery_codes` (`account_id`) WHERE "account_recovery_codes"."used_at" is null;--> statement-breakpoint
CREATE INDEX `account_recovery_codes_account_created_idx` ON `account_recovery_codes` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer,
	`event_type` text NOT NULL,
	`subject_hash` text NOT NULL,
	`success` integer DEFAULT false NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `local_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `auth_audit_event_created_idx` ON `auth_audit_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_audit_account_created_idx` ON `auth_audit_events` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_rate_limit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scope` text NOT NULL,
	`subject_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_rate_limit_scope_subject_created_idx` ON `auth_rate_limit_events` (`scope`,`subject_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `auth_rate_limit_created_idx` ON `auth_rate_limit_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `local_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_uidx` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_account_expiry_idx` ON `auth_sessions` (`account_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_revoked_idx` ON `auth_sessions` (`expires_at`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `local_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`password_algorithm` text DEFAULT 'pbkdf2-hmac-sha256' NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer DEFAULT 600000 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`password_changed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_email`) REFERENCES `users`(`email`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "local_accounts_algorithm_check" CHECK("local_accounts"."password_algorithm" = 'pbkdf2-hmac-sha256'),
	CONSTRAINT "local_accounts_iterations_check" CHECK("local_accounts"."password_iterations" >= 600000),
	CONSTRAINT "local_accounts_status_check" CHECK("local_accounts"."status" in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_accounts_user_email_uidx` ON `local_accounts` (`user_email`);--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `local_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_hash_uidx` ON `password_reset_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_account_expiry_idx` ON `password_reset_tokens` (`account_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `platform_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`rotated_at` text
);
