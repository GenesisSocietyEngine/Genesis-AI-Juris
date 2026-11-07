CREATE TABLE `firm_contact_cases` (
	`organization_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`dossier_id` text NOT NULL,
	FOREIGN KEY (`organization_id`,`contact_id`) REFERENCES `firm_contacts`(`organization_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`dossier_id`) REFERENCES `dossier_organization_bindings`(`organization_id`,`dossier_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_contact_case` ON `firm_contact_cases` (`organization_id`,`contact_id`,`dossier_id`);--> statement-breakpoint
CREATE TABLE `firm_contact_operations` (
	`organization_id` text NOT NULL,
	`actor_ref` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`action` text NOT NULL,
	`contact_ids` text NOT NULL,
	`reverses` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_contact_operation` ON `firm_contact_operations` (`organization_id`,`actor_ref`,`operation_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_contact_undo` ON `firm_contact_operations` (`organization_id`,`actor_ref`,`reverses`);--> statement-breakpoint
CREATE INDEX `firm_contact_import_history` ON `firm_contact_operations` (`organization_id`,`actor_ref`,`action`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `firm_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`kind` text NOT NULL,
	`profile` text NOT NULL,
	`name_key` text NOT NULL,
	`email_key` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "firm_contact_state" CHECK("firm_contacts"."revision" > 0 AND "firm_contacts"."kind" IN ('person','company') AND "firm_contacts"."status" IN ('active','archived') AND json_valid("firm_contacts"."profile"))
);--> statement-breakpoint
CREATE UNIQUE INDEX `firm_contact_scope` ON `firm_contacts` (`organization_id`,`id`);--> statement-breakpoint
CREATE INDEX `firm_contact_name` ON `firm_contacts` (`organization_id`,`kind`,`name_key`);--> statement-breakpoint
CREATE INDEX `firm_contact_email` ON `firm_contacts` (`organization_id`,`email_key`);--> statement-breakpoint
CREATE TRIGGER firm_contact_receipt_keep_update BEFORE UPDATE ON firm_contact_operations BEGIN SELECT RAISE(ABORT,'immutable_contact_receipt'); END;--> statement-breakpoint
CREATE TRIGGER firm_contact_receipt_keep_delete BEFORE DELETE ON firm_contact_operations BEGIN SELECT RAISE(ABORT,'immutable_contact_receipt'); END;--> statement-breakpoint
CREATE TRIGGER firm_contact_recoverable BEFORE DELETE ON firm_contacts BEGIN SELECT RAISE(ABORT,'archive_contact_instead'); END;
