CREATE TABLE `case_workflow_milestones` (
	`dossier_id` text NOT NULL,
	`revision` integer NOT NULL,
	`workflow` text NOT NULL,
	`schedule` text NOT NULL,
	FOREIGN KEY (`dossier_id`,`revision`) REFERENCES `dossier_practice_revisions`(`dossier_id`,`revision`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `case_milestones_revision` ON `case_workflow_milestones` (`dossier_id`,`revision`);--> statement-breakpoint
CREATE INDEX `case_milestones_application` ON `case_workflow_milestones` (`dossier_id`,`workflow`,`revision`);--> statement-breakpoint
CREATE TABLE `workflow_template_milestones` (
	`organization_id` text NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`library_revision` integer NOT NULL,
	`names` text NOT NULL,
	FOREIGN KEY (`organization_id`,`library_revision`) REFERENCES `organization_workflow_revisions`(`organization_id`,`revision`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `template_milestones_version` ON `workflow_template_milestones` (`organization_id`,`template_id`,`version`);--> statement-breakpoint
CREATE TRIGGER case_workflow_milestones_immutable_update BEFORE UPDATE ON case_workflow_milestones BEGIN SELECT RAISE(ABORT,'workflow_milestones_immutable'); END;--> statement-breakpoint
CREATE TRIGGER case_workflow_milestones_immutable_delete BEFORE DELETE ON case_workflow_milestones BEGIN SELECT RAISE(ABORT,'workflow_milestones_immutable'); END;--> statement-breakpoint
CREATE TRIGGER workflow_template_milestones_immutable_update BEFORE UPDATE ON workflow_template_milestones BEGIN SELECT RAISE(ABORT,'workflow_milestones_immutable'); END;--> statement-breakpoint
CREATE TRIGGER workflow_template_milestones_immutable_delete BEFORE DELETE ON workflow_template_milestones BEGIN SELECT RAISE(ABORT,'workflow_milestones_immutable'); END;
