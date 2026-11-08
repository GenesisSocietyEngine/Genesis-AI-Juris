CREATE TABLE `case_work_revisions` (
	`organization_id` text NOT NULL,
	`id` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`case_id` text,
	`source_id` text,
	`source_revision` integer,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`stage` text NOT NULL,
	`status_filter` text NOT NULL,
	`archived` integer NOT NULL,
	`actor_ref` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`case_id`) REFERENCES `dossier_organization_bindings`(`organization_id`,`dossier_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organization_id`,`source_id`,`source_revision`) REFERENCES `case_work_revisions`(`organization_id`,`id`,`revision`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "case_work_kind" CHECK("case_work_revisions"."revision">0 AND (("case_work_revisions"."kind" IN ('template','view') AND "case_work_revisions"."case_id" IS NULL) OR ("case_work_revisions"."kind" IN ('document','progress') AND "case_work_revisions"."case_id" IS NOT NULL)) AND (("case_work_revisions"."kind"='document' AND "case_work_revisions"."source_id" IS NOT NULL AND "case_work_revisions"."source_revision" IS NOT NULL AND "case_work_revisions"."revision"=1) OR ("case_work_revisions"."kind"<>'document' AND "case_work_revisions"."source_id" IS NULL AND "case_work_revisions"."source_revision" IS NULL)))
);--> statement-breakpoint
CREATE UNIQUE INDEX `case_work_revision` ON `case_work_revisions` (`organization_id`,`id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `case_work_operation` ON `case_work_revisions` (`organization_id`,`actor_ref`,`operation_key`);--> statement-breakpoint
CREATE INDEX `case_work_scope` ON `case_work_revisions` (`organization_id`,`kind`,`case_id`,`id`);--> statement-breakpoint
CREATE TRIGGER case_work_immutable_update BEFORE UPDATE ON case_work_revisions BEGIN SELECT RAISE(ABORT,'immutable_case_work_revision'); END;--> statement-breakpoint
CREATE TRIGGER case_work_immutable_delete BEFORE DELETE ON case_work_revisions BEGIN SELECT RAISE(ABORT,'immutable_case_work_revision'); END;
