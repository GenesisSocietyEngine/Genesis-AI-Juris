CREATE TABLE `intake_revisions` (
	`organization_id` text NOT NULL,
	`id` text NOT NULL,
	`revision` integer NOT NULL,
	`case_id` text,
	`template_id` text,
	`template_revision` integer,
	`status` text NOT NULL,
	`title` text NOT NULL,
	`questions` text NOT NULL,
	`answers` text NOT NULL,
	`actor_ref` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`case_id`) REFERENCES `dossier_organization_bindings`(`organization_id`,`dossier_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`template_id`,`template_revision`) REFERENCES `intake_revisions`(`organization_id`,`id`,`revision`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "intake_kind" CHECK("intake_revisions"."revision" > 0 AND (("intake_revisions"."case_id" IS NULL AND "intake_revisions"."template_id" IS NULL AND "intake_revisions"."template_revision" IS NULL AND "intake_revisions"."status" IN ('available','archived')) OR ("intake_revisions"."case_id" IS NOT NULL AND "intake_revisions"."template_id" IS NOT NULL AND "intake_revisions"."template_revision" IS NOT NULL AND "intake_revisions"."status" IN ('draft','complete'))))
);--> statement-breakpoint
CREATE UNIQUE INDEX `intake_revision` ON `intake_revisions` (`organization_id`,`id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `intake_operation` ON `intake_revisions` (`organization_id`,`actor_ref`,`operation_key`);--> statement-breakpoint
CREATE INDEX `intake_case` ON `intake_revisions` (`organization_id`,`case_id`,`id`);--> statement-breakpoint
CREATE TRIGGER intake_keep_update BEFORE UPDATE ON intake_revisions BEGIN SELECT RAISE(ABORT,'immutable_intake_revision'); END;--> statement-breakpoint
CREATE TRIGGER intake_keep_delete BEFORE DELETE ON intake_revisions BEGIN SELECT RAISE(ABORT,'immutable_intake_revision'); END;
