CREATE TABLE `dossier_request_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`actor_ref` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`request_id` text NOT NULL,
	`revision` integer NOT NULL,
	`audit_event_id` text NOT NULL,
	`result` text NOT NULL,
	`http_status` integer NOT NULL,
	FOREIGN KEY (`dossier_id`,`request_id`) REFERENCES `dossier_information_requests`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`audit_event_id`) REFERENCES `dossier_audit_events`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "request_operations_result_check" CHECK(json_valid("dossier_request_operations"."result") and "dossier_request_operations"."http_status" in (200,201))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `request_operations_key_uidx` ON `dossier_request_operations` (`dossier_id`,`actor_ref`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `dossier_working_note_applications` (
	`event_id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`note_id` text NOT NULL,
	`revision` integer NOT NULL,
	`source_link_id` text NOT NULL,
	`action` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `dossier_working_note_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_link_id`) REFERENCES `dossier_working_note_sources`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "working_note_applications_action_check" CHECK("dossier_working_note_applications"."action" in ('link','unlink'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `working_note_applications_binding_uidx` ON `dossier_working_note_applications` (`dossier_id`,`note_id`,`revision`,`source_link_id`,`action`);--> statement-breakpoint
CREATE TABLE `dossier_working_note_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`note_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`source_anchor_id` text,
	`anchor_key` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_revision` integer NOT NULL,
	`unlinked_revision` integer,
	FOREIGN KEY (`dossier_id`,`note_id`) REFERENCES `dossier_working_notes`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`note_id`,`created_revision`) REFERENCES `dossier_working_note_versions`(`dossier_id`,`note_id`,`revision`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`note_id`,`unlinked_revision`) REFERENCES `dossier_working_note_versions`(`dossier_id`,`note_id`,`revision`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`document_id`,`document_version_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "working_note_sources_anchor_key_check" CHECK("dossier_working_note_sources"."anchor_key"=coalesce("dossier_working_note_sources"."source_anchor_id",'')),
	CONSTRAINT "working_note_sources_state_check" CHECK(("dossier_working_note_sources"."active"=1 and "dossier_working_note_sources"."unlinked_revision" is null) or ("dossier_working_note_sources"."active"=0 and "dossier_working_note_sources"."unlinked_revision">"dossier_working_note_sources"."created_revision"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `working_note_sources_scope_uidx` ON `dossier_working_note_sources` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `working_note_sources_active_uidx` ON `dossier_working_note_sources` (`dossier_id`,`note_id`,`document_id`,`document_version_id`,`anchor_key`) WHERE "dossier_working_note_sources"."active"=1;--> statement-breakpoint
CREATE INDEX `working_note_sources_backlinks_idx` ON `dossier_working_note_sources` (`dossier_id`,`document_id`,`active`);--> statement-breakpoint
CREATE TABLE `dossier_working_note_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`note_id` text NOT NULL,
	`revision` integer NOT NULL,
	`title` text NOT NULL,
	`note_type` text NOT NULL,
	`body` text NOT NULL,
	`action` text NOT NULL,
	`source_link_id` text,
	`actor_user_id` integer NOT NULL,
	`actor_ref` text NOT NULL,
	`actor_role` text NOT NULL,
	`occurred_at` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_digest` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`note_id`) REFERENCES `dossier_working_notes`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`note_id`,`revision`,`source_link_id`,`action`) REFERENCES `dossier_working_note_applications`(`dossier_id`,`note_id`,`revision`,`source_link_id`,`action`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "working_note_versions_content_check" CHECK(length(trim("dossier_working_note_versions"."title")) between 1 and 200 and length("dossier_working_note_versions"."body")<=100000 and "dossier_working_note_versions"."note_type" in ('blank','meeting','analysis')),
	CONSTRAINT "working_note_versions_action_check" CHECK("dossier_working_note_versions"."action" in ('create','save','link','unlink') and (("dossier_working_note_versions"."action" in ('link','unlink'))=("dossier_working_note_versions"."source_link_id" is not null))),
	CONSTRAINT "working_note_versions_role_check" CHECK("dossier_working_note_versions"."actor_role" in ('owner','contributor'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `working_note_versions_revision_uidx` ON `dossier_working_note_versions` (`dossier_id`,`note_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `working_note_versions_operation_uidx` ON `dossier_working_note_versions` (`dossier_id`,`actor_ref`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `dossier_working_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`revision` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`organization_id`,`dossier_id`) REFERENCES `dossier_organization_bindings`(`organization_id`,`dossier_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`id`,`revision`) REFERENCES `dossier_working_note_versions`(`dossier_id`,`note_id`,`revision`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "working_notes_revision_check" CHECK("dossier_working_notes"."revision">=1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `working_notes_scope_uidx` ON `dossier_working_notes` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `working_notes_case_updated_idx` ON `dossier_working_notes` (`dossier_id`,`updated_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_source_anchors_exact_version_uidx` ON `dossier_source_anchors` (`dossier_id`,`document_id`,`document_version_id`,`id`);
--> statement-breakpoint
CREATE TRIGGER working_notes_identity_guard BEFORE UPDATE ON dossier_working_notes BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.dossier_id<>OLD.dossier_id OR NEW.organization_id<>OLD.organization_id OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1
 OR NOT EXISTS(SELECT 1 FROM dossier_working_note_versions v WHERE v.dossier_id=NEW.dossier_id AND v.note_id=NEW.id AND v.revision=NEW.revision AND v.occurred_at=NEW.updated_at)
 THEN RAISE(ABORT,'note update requires exact immutable revision') END;
END;--> statement-breakpoint
CREATE TRIGGER working_notes_delete_guard BEFORE DELETE ON dossier_working_notes BEGIN SELECT RAISE(ABORT,'working note history is retained'); END;--> statement-breakpoint
CREATE TRIGGER working_note_version_authority_guard BEFORE INSERT ON dossier_working_note_versions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM dossier_working_notes n
 JOIN dossier_organization_bindings b ON b.dossier_id=n.dossier_id AND b.organization_id=n.organization_id
 JOIN organizations o ON o.id=b.organization_id AND o.status='active'
 JOIN organization_memberships m ON m.organization_id=o.id AND m.actor_id=NEW.actor_ref AND m.user_id=NEW.actor_user_id AND m.status='active'
 JOIN dossier_participants p ON p.dossier_id=n.dossier_id AND p.actor_id=NEW.actor_ref AND p.user_id=NEW.actor_user_id AND p.role=NEW.actor_role AND p.status='active'
 WHERE n.dossier_id=NEW.dossier_id AND n.id=NEW.note_id AND p.role IN ('owner','contributor')
 AND ((NEW.action='create' AND NEW.revision=1 AND n.revision=1 AND n.created_by=NEW.actor_ref AND n.created_at=NEW.occurred_at AND n.updated_at=NEW.occurred_at)
 OR (NEW.action<>'create' AND NEW.revision=n.revision+1))) THEN RAISE(ABORT,'note revision requires current case authority') END;
 SELECT CASE WHEN length(NEW.idempotency_key) NOT BETWEEN 8 AND 120 OR length(NEW.request_digest)<>71 THEN RAISE(ABORT,'note operation identity required') END;
 SELECT CASE WHEN NEW.action IN ('link','unlink') AND NOT EXISTS(SELECT 1 FROM dossier_working_note_versions v WHERE v.dossier_id=NEW.dossier_id AND v.note_id=NEW.note_id AND v.revision=NEW.revision-1 AND v.title=NEW.title AND v.body=NEW.body AND v.note_type=NEW.note_type) THEN RAISE(ABORT,'association changes preserve note content') END;
END;--> statement-breakpoint
CREATE TRIGGER working_note_versions_update_guard BEFORE UPDATE ON dossier_working_note_versions BEGIN SELECT RAISE(ABORT,'note revisions are immutable'); END;--> statement-breakpoint
CREATE TRIGGER working_note_versions_delete_guard BEFORE DELETE ON dossier_working_note_versions BEGIN SELECT RAISE(ABORT,'note revisions are immutable'); END;--> statement-breakpoint
CREATE TRIGGER working_note_source_insert_guard BEFORE INSERT ON dossier_working_note_sources BEGIN
 SELECT CASE WHEN NEW.active<>1 OR NEW.unlinked_revision IS NOT NULL OR NOT EXISTS(SELECT 1 FROM dossier_working_note_versions v WHERE v.dossier_id=NEW.dossier_id AND v.note_id=NEW.note_id AND v.revision=NEW.created_revision AND v.action='link' AND v.source_link_id=NEW.id) THEN RAISE(ABORT,'source association requires immutable link event') END;
END;--> statement-breakpoint
CREATE TRIGGER working_note_source_update_guard BEFORE UPDATE ON dossier_working_note_sources BEGIN
 SELECT CASE WHEN NEW.id<>OLD.id OR NEW.dossier_id<>OLD.dossier_id OR NEW.note_id<>OLD.note_id OR NEW.document_id<>OLD.document_id OR NEW.document_version_id<>OLD.document_version_id OR NEW.source_anchor_id IS NOT OLD.source_anchor_id OR NEW.anchor_key<>OLD.anchor_key OR NEW.created_revision<>OLD.created_revision OR OLD.active<>1 OR NEW.active<>0
 OR NOT EXISTS(SELECT 1 FROM dossier_working_note_versions v WHERE v.dossier_id=NEW.dossier_id AND v.note_id=NEW.note_id AND v.revision=NEW.unlinked_revision AND v.action='unlink' AND v.source_link_id=NEW.id) THEN RAISE(ABORT,'unlink requires immutable event and preserves source identity') END;
END;--> statement-breakpoint
CREATE TRIGGER working_note_source_delete_guard BEFORE DELETE ON dossier_working_note_sources BEGIN SELECT RAISE(ABORT,'source association history is retained'); END;--> statement-breakpoint
CREATE TRIGGER request_operations_insert_guard BEFORE INSERT ON dossier_request_operations BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM dossier_audit_events a JOIN dossier_information_requests r ON r.dossier_id=a.dossier_id AND r.id=a.object_ref_id
 WHERE a.dossier_id=NEW.dossier_id AND a.id=NEW.audit_event_id AND a.actor_ref=NEW.actor_ref AND a.dossier_revision=NEW.revision AND a.event_type='information_request_changed' AND r.id=NEW.request_id
 AND json_extract(NEW.result,'$.request.information_request_id')=r.id AND json_extract(NEW.result,'$.request.dossier_id')=r.dossier_id
 AND json_extract(NEW.result,'$.request.status')=r.status AND json_extract(NEW.result,'$.request.satisfying_document_id') IS r.satisfying_document_id AND json_extract(NEW.result,'$.request.satisfying_evidence_link_id') IS r.satisfying_evidence_link_id
 AND json_extract(NEW.result,'$.audit_event_id')=a.id AND json_extract(NEW.result,'$.dossier.dossier_id')=a.dossier_id AND json_extract(NEW.result,'$.dossier.revision')=a.dossier_revision)
 OR EXISTS(SELECT 1 FROM dossier_request_operations existing WHERE existing.dossier_id=NEW.dossier_id AND existing.audit_event_id=NEW.audit_event_id)
 OR length(NEW.idempotency_key) NOT BETWEEN 8 AND 120 OR length(NEW.request_digest)<>71
 THEN RAISE(ABORT,'request receipt requires exact authorized audit') END;
END;--> statement-breakpoint
CREATE TRIGGER request_operations_update_guard BEFORE UPDATE ON dossier_request_operations BEGIN SELECT RAISE(ABORT,'request receipts are immutable'); END;--> statement-breakpoint
CREATE TRIGGER request_operations_delete_guard BEFORE DELETE ON dossier_request_operations BEGIN SELECT RAISE(ABORT,'request receipts are immutable'); END;

--> statement-breakpoint
CREATE TRIGGER working_note_link_application AFTER INSERT ON dossier_working_note_sources BEGIN
 INSERT INTO dossier_working_note_applications(event_id,dossier_id,note_id,revision,source_link_id,action)
 SELECT id,dossier_id,note_id,revision,source_link_id,action FROM dossier_working_note_versions WHERE dossier_id=NEW.dossier_id AND note_id=NEW.note_id AND revision=NEW.created_revision AND source_link_id=NEW.id AND action='link';
END;--> statement-breakpoint
CREATE TRIGGER working_note_unlink_application AFTER UPDATE ON dossier_working_note_sources BEGIN
 INSERT INTO dossier_working_note_applications(event_id,dossier_id,note_id,revision,source_link_id,action)
 SELECT id,dossier_id,note_id,revision,source_link_id,action FROM dossier_working_note_versions WHERE dossier_id=NEW.dossier_id AND note_id=NEW.note_id AND revision=NEW.unlinked_revision AND source_link_id=NEW.id AND action='unlink';
END;--> statement-breakpoint
CREATE TRIGGER working_note_application_insert_guard BEFORE INSERT ON dossier_working_note_applications BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM dossier_working_note_versions v JOIN dossier_working_note_sources s ON s.dossier_id=v.dossier_id AND s.note_id=v.note_id AND s.id=v.source_link_id
 WHERE v.id=NEW.event_id AND v.dossier_id=NEW.dossier_id AND v.note_id=NEW.note_id AND v.revision=NEW.revision AND v.source_link_id=NEW.source_link_id AND v.action=NEW.action
 AND ((NEW.action='link' AND s.created_revision=NEW.revision AND s.active=1) OR (NEW.action='unlink' AND s.unlinked_revision=NEW.revision AND s.active=0))) THEN RAISE(ABORT,'note event requires exact association application') END;
END;--> statement-breakpoint
CREATE TRIGGER working_note_application_update_guard BEFORE UPDATE ON dossier_working_note_applications BEGIN SELECT RAISE(ABORT,'note application is immutable'); END;--> statement-breakpoint
CREATE TRIGGER working_note_application_delete_guard BEFORE DELETE ON dossier_working_note_applications BEGIN SELECT RAISE(ABORT,'note application is immutable'); END;
