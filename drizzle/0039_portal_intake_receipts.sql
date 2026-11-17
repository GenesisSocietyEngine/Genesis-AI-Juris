CREATE TABLE `portal_intake_receipts` (
	`request_id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`recipient` text NOT NULL,
	`answers` text NOT NULL,
	`stamp` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `portal_intake_requests`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `portal_intake_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`intake_id` text NOT NULL,
	`revision` integer NOT NULL,
	`issuer` text NOT NULL,
	`stamp` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `portal_grants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`intake_id`,`revision`) REFERENCES `intake_revisions`(`organization_id`,`id`,`revision`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_intake_assignment` ON `portal_intake_requests` (`grant_id`,`intake_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX portal_intake_receipt_number ON portal_intake_receipts (number);--> statement-breakpoint
CREATE TRIGGER portal_intake_requests_keep_update BEFORE UPDATE ON portal_intake_requests BEGIN SELECT RAISE(ABORT,'immutable_intake_evidence'); END;--> statement-breakpoint
CREATE TRIGGER portal_intake_requests_keep_delete BEFORE DELETE ON portal_intake_requests BEGIN SELECT RAISE(ABORT,'immutable_intake_evidence'); END;--> statement-breakpoint
CREATE TRIGGER portal_intake_receipts_keep_update BEFORE UPDATE ON portal_intake_receipts BEGIN SELECT RAISE(ABORT,'immutable_intake_evidence'); END;--> statement-breakpoint
CREATE TRIGGER portal_intake_receipts_keep_delete BEFORE DELETE ON portal_intake_receipts BEGIN SELECT RAISE(ABORT,'immutable_intake_evidence'); END;
