CREATE TABLE `billing_events` (
	`organization_id` text NOT NULL,
	`case_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`operation_key` text NOT NULL,
	`actor_ref` text NOT NULL,
	`request_digest` text NOT NULL,
	`event` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`case_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "billing_positive_sequence" CHECK("billing_events"."sequence" > 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_case_sequence` ON `billing_events` (`organization_id`,`case_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_actor_operation` ON `billing_events` (`organization_id`,`actor_ref`,`operation_key`);