CREATE TABLE `dossier_deadline_dispositions` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`deadline_reference_id` text NOT NULL,
	`new_status` text NOT NULL,
	`supporting_source_anchor_id` text,
	`reason` text NOT NULL,
	`actor_user_id` integer NOT NULL,
	`actor_ref` text NOT NULL,
	`actor_role` text NOT NULL,
	`occurred_at` text NOT NULL,
	`revision_before` integer NOT NULL,
	`revision_after` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`audit_event_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`deadline_reference_id`) REFERENCES `dossier_deadline_references`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`supporting_source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`audit_event_id`) REFERENCES `dossier_audit_events`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_deadline_dispositions_revision_check" CHECK("dossier_deadline_dispositions"."revision_before" >= 1 and "dossier_deadline_dispositions"."revision_after" = "dossier_deadline_dispositions"."revision_before" + 1),
	CONSTRAINT "dossier_deadline_dispositions_reason_check" CHECK(length(trim("dossier_deadline_dispositions"."reason")) between 5 and 2000),
	CONSTRAINT "dossier_deadline_dispositions_role_check" CHECK("dossier_deadline_dispositions"."actor_role" in ('owner','contributor','reviewer'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_deadline_dispositions_record_uidx` ON `dossier_deadline_dispositions` (`dossier_id`,`deadline_reference_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_deadline_dispositions_request_uidx` ON `dossier_deadline_dispositions` (`dossier_id`,`actor_ref`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `dossier_source_anchor_retirements` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	`replacement_source_anchor_id` text,
	`reason` text NOT NULL,
	`actor_user_id` integer NOT NULL,
	`actor_ref` text NOT NULL,
	`actor_role` text NOT NULL,
	`occurred_at` text NOT NULL,
	`revision_before` integer NOT NULL,
	`revision_after` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`audit_event_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`replacement_source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`audit_event_id`) REFERENCES `dossier_audit_events`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_source_anchor_retirements_revision_check" CHECK("dossier_source_anchor_retirements"."revision_before" >= 1 and "dossier_source_anchor_retirements"."revision_after" = "dossier_source_anchor_retirements"."revision_before" + 1),
	CONSTRAINT "dossier_source_anchor_retirements_reason_check" CHECK(length(trim("dossier_source_anchor_retirements"."reason")) between 5 and 2000),
	CONSTRAINT "dossier_source_anchor_retirements_role_check" CHECK("dossier_source_anchor_retirements"."actor_role" in ('owner','contributor','reviewer'))
);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_source_anchor_retirements_record_uidx` ON `dossier_source_anchor_retirements` (`dossier_id`,`source_anchor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_source_anchor_retirements_request_uidx` ON `dossier_source_anchor_retirements` (`dossier_id`,`actor_ref`,`idempotency_key`);--> statement-breakpoint
CREATE TRIGGER dossier_deadline_dispositions_insert_guard BEFORE INSERT ON dossier_deadline_dispositions BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM dossiers d JOIN dossier_participants p ON p.dossier_id=d.id
 WHERE d.id=NEW.dossier_id AND d.revision=NEW.revision_after AND d.updated_by_actor_ref=NEW.actor_ref AND d.updated_at=NEW.occurred_at
 AND p.actor_id=NEW.actor_ref AND p.user_id=NEW.actor_user_id AND p.role=NEW.actor_role AND p.status='active'
 AND p.role IN ('owner','contributor','reviewer') AND NOT EXISTS(SELECT 1 FROM dossier_revision_receipts r WHERE r.dossier_id=d.id AND r.resulting_revision=d.revision))
 THEN RAISE(ABORT,'review disposition requires an active authorized revision') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM dossier_audit_events WHERE dossier_id=NEW.dossier_id AND id=NEW.audit_event_id)
 OR length(NEW.idempotency_key) NOT BETWEEN 8 AND 120 OR length(NEW.request_digest)<>71
 THEN RAISE(ABORT,'review disposition requires a new exact audit and request') END);
 END;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_dispositions_update_guard BEFORE UPDATE ON dossier_deadline_dispositions BEGIN SELECT RAISE(ABORT,'review disposition is append only'); END;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_dispositions_delete_guard BEFORE DELETE ON dossier_deadline_dispositions BEGIN SELECT RAISE(ABORT,'review disposition is append only'); END;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_dispositions_audit_claim AFTER INSERT ON dossier_deadline_dispositions BEGIN
 INSERT INTO dossier_required_audits (id,dossier_id,dossier_revision,claim_phase,event_type,object_ref_type,object_ref_id,actor_ref,occurred_at)
 VALUES ('claim:'||lower(hex(randomblob(16))),NEW.dossier_id,NEW.revision_after,'revision','dossier_updated','dossier',NEW.dossier_id,NEW.actor_ref,NEW.occurred_at);
 END;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_dispositions_exact_audit BEFORE INSERT ON dossier_audit_events
 WHEN NEW.summary_code='HISTORICAL_DEADLINE_DISPOSED' OR EXISTS(SELECT 1 FROM dossier_deadline_dispositions r WHERE r.audit_event_id=NEW.id)
 BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM dossier_deadline_dispositions r WHERE r.audit_event_id=NEW.id
 AND r.dossier_id=NEW.dossier_id AND r.revision_after=NEW.dossier_revision AND r.actor_user_id=NEW.actor_user_id
 AND r.actor_ref=NEW.actor_ref AND r.actor_role=NEW.actor_role AND r.occurred_at=NEW.occurred_at
 AND NEW.event_type='dossier_updated' AND NEW.object_ref_type='dossier' AND NEW.object_ref_id=r.dossier_id AND NEW.summary_code='HISTORICAL_DEADLINE_DISPOSED'
 AND json_valid(NEW.detail) AND json_extract(NEW.detail,'$.action_schema_version')=1 AND json_extract(NEW.detail,'$.action')='dispose_historical_deadline'
 AND json_extract(NEW.detail,'$.disposition_id')=r.id AND json_extract(NEW.detail,'$.deadline_reference_id')=r.deadline_reference_id
 AND json_extract(NEW.detail,'$.reason')=r.reason AND json_extract(NEW.detail,'$.revision_before')=r.revision_before
 AND json_extract(NEW.detail,'$.revision_after')=r.revision_after AND json_extract(NEW.detail,'$.previous_status')='open' AND json_extract(NEW.detail,'$.new_status')=r.new_status AND json_extract(NEW.detail,'$.supporting_source_anchor_id') IS r.supporting_source_anchor_id AND EXISTS(SELECT 1 FROM dossier_deadline_references d WHERE d.dossier_id=r.dossier_id AND d.id=r.deadline_reference_id AND d.status=r.new_status AND d.updated_at=r.occurred_at AND d.updated_by_actor_ref=r.actor_ref AND json_extract(NEW.detail,'$.original_due_at')=d.due_at AND json_extract(NEW.detail,'$.original_timezone')=d.timezone))
 THEN RAISE(ABORT,'review disposition audit must match its exact immutable record') END); END;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchor_retirements_insert_guard BEFORE INSERT ON dossier_source_anchor_retirements BEGIN
 SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM dossiers d JOIN dossier_participants p ON p.dossier_id=d.id
 WHERE d.id=NEW.dossier_id AND d.revision=NEW.revision_after AND d.updated_by_actor_ref=NEW.actor_ref AND d.updated_at=NEW.occurred_at
 AND p.actor_id=NEW.actor_ref AND p.user_id=NEW.actor_user_id AND p.role=NEW.actor_role AND p.status='active'
 AND p.role IN ('owner','contributor','reviewer') AND NOT EXISTS(SELECT 1 FROM dossier_revision_receipts r WHERE r.dossier_id=d.id AND r.resulting_revision=d.revision))
 THEN RAISE(ABORT,'review disposition requires an active authorized revision') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM dossier_audit_events WHERE dossier_id=NEW.dossier_id AND id=NEW.audit_event_id)
 OR length(NEW.idempotency_key) NOT BETWEEN 8 AND 120 OR length(NEW.request_digest)<>71
 THEN RAISE(ABORT,'review disposition requires a new exact audit and request') END);
 END;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchor_retirements_update_guard BEFORE UPDATE ON dossier_source_anchor_retirements BEGIN SELECT RAISE(ABORT,'review disposition is append only'); END;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchor_retirements_delete_guard BEFORE DELETE ON dossier_source_anchor_retirements BEGIN SELECT RAISE(ABORT,'review disposition is append only'); END;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchor_retirements_audit_claim AFTER INSERT ON dossier_source_anchor_retirements BEGIN
 INSERT INTO dossier_required_audits (id,dossier_id,dossier_revision,claim_phase,event_type,object_ref_type,object_ref_id,actor_ref,occurred_at)
 VALUES ('claim:'||lower(hex(randomblob(16))),NEW.dossier_id,NEW.revision_after,'revision','source_anchor_reviewed','source_anchor',NEW.source_anchor_id,NEW.actor_ref,NEW.occurred_at);
 END;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchor_retirements_exact_audit BEFORE INSERT ON dossier_audit_events
 WHEN NEW.summary_code='SOURCE_ANCHOR_RETIRED' OR EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.audit_event_id=NEW.id)
 BEGIN SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.audit_event_id=NEW.id
 AND r.dossier_id=NEW.dossier_id AND r.revision_after=NEW.dossier_revision AND r.actor_user_id=NEW.actor_user_id
 AND r.actor_ref=NEW.actor_ref AND r.actor_role=NEW.actor_role AND r.occurred_at=NEW.occurred_at
 AND NEW.event_type='source_anchor_reviewed' AND NEW.object_ref_type='source_anchor' AND NEW.object_ref_id=r.source_anchor_id AND NEW.summary_code='SOURCE_ANCHOR_RETIRED'
 AND json_valid(NEW.detail) AND json_extract(NEW.detail,'$.action_schema_version')=1 AND json_extract(NEW.detail,'$.action')='retire'
 AND json_extract(NEW.detail,'$.disposition_id')=r.id AND json_extract(NEW.detail,'$.source_anchor_id')=r.source_anchor_id
 AND json_extract(NEW.detail,'$.reason')=r.reason AND json_extract(NEW.detail,'$.revision_before')=r.revision_before
 AND json_extract(NEW.detail,'$.revision_after')=r.revision_after AND json_extract(NEW.detail,'$.replacement_source_anchor_id') IS r.replacement_source_anchor_id)
 THEN RAISE(ABORT,'review disposition audit must match its exact immutable record') END); END;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_dispositions_domain_guard BEFORE INSERT ON dossier_deadline_dispositions BEGIN
 SELECT (CASE WHEN NEW.new_status NOT IN ('completed','waived','cancelled') OR NOT EXISTS(SELECT 1 FROM dossier_deadline_references d WHERE d.id=NEW.deadline_reference_id AND d.dossier_id=NEW.dossier_id AND d.deadline_kind='workspace' AND d.status='open' AND julianday(d.due_at)<julianday(NEW.occurred_at)) THEN RAISE(ABORT,'only open historical workspace deadlines can be disposed') END);
 SELECT (CASE WHEN NEW.supporting_source_anchor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dossier_source_anchors a JOIN dossier_document_current_versions c ON c.dossier_id=a.dossier_id AND c.document_version_id=a.document_version_id WHERE a.dossier_id=NEW.dossier_id AND a.id=NEW.supporting_source_anchor_id AND a.review_state='accepted' AND NOT EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=a.dossier_id AND r.source_anchor_id=a.id)) THEN RAISE(ABORT,'support must be an active current accepted citation') END);
END;--> statement-breakpoint
DROP TRIGGER dossier_deadline_references_unregistered_update_guard;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_references_disposition_guard BEFORE UPDATE ON dossier_deadline_references BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.dossier_id IS NOT OLD.dossier_id OR NEW.deadline_kind IS NOT OLD.deadline_kind OR NEW.title IS NOT OLD.title OR NEW.due_at IS NOT OLD.due_at OR NEW.timezone IS NOT OLD.timezone OR NEW.critical IS NOT OLD.critical OR NEW.decision_package_reference_id IS NOT OLD.decision_package_reference_id OR NEW.simulation_deadline_id IS NOT OLD.simulation_deadline_id OR NEW.created_by_actor_ref IS NOT OLD.created_by_actor_ref OR NEW.created_at IS NOT OLD.created_at OR OLD.status<>'open' OR NOT EXISTS(SELECT 1 FROM dossier_deadline_dispositions r JOIN dossiers d ON d.id=r.dossier_id WHERE r.dossier_id=OLD.dossier_id AND r.deadline_reference_id=OLD.id AND r.new_status=NEW.status AND r.actor_ref=NEW.updated_by_actor_ref AND r.occurred_at=NEW.updated_at AND r.revision_after=d.revision AND NOT EXISTS(SELECT 1 FROM dossier_revision_receipts c WHERE c.dossier_id=d.id AND c.resulting_revision=d.revision)) THEN RAISE(ABORT,'deadline update requires its exact pending disposition; original context is immutable') END);
END;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchor_retirements_domain_guard BEFORE INSERT ON dossier_source_anchor_retirements BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM dossier_source_anchors a JOIN dossier_document_current_versions c ON c.dossier_id=a.dossier_id AND c.document_id=a.document_id WHERE a.id=NEW.source_anchor_id AND a.dossier_id=NEW.dossier_id AND a.review_state='accepted' AND a.document_version_id<>c.document_version_id) THEN RAISE(ABORT,'only accepted stale citations may be retired') END);
 SELECT (CASE WHEN NEW.replacement_source_anchor_id IS NOT NULL AND (NEW.replacement_source_anchor_id=NEW.source_anchor_id OR NOT EXISTS(SELECT 1 FROM dossier_source_anchors a JOIN dossier_document_current_versions c ON c.dossier_id=a.dossier_id AND c.document_version_id=a.document_version_id WHERE a.id=NEW.replacement_source_anchor_id AND a.dossier_id=NEW.dossier_id AND a.review_state='accepted' AND NOT EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=a.dossier_id AND r.source_anchor_id=a.id))) THEN RAISE(ABORT,'replacement must be an active current accepted citation') END);
END;--> statement-breakpoint
CREATE TRIGGER dossier_assertion_sources_retired_source_guard BEFORE INSERT ON dossier_assertion_sources
 WHEN EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=NEW.dossier_id AND r.source_anchor_id=NEW.source_anchor_id)
 BEGIN SELECT RAISE(ABORT,'retired citations cannot support new work'); END;--> statement-breakpoint
CREATE TRIGGER dossier_evidence_links_retired_source_guard BEFORE INSERT ON dossier_evidence_links
 WHEN EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=NEW.dossier_id AND r.source_anchor_id=NEW.source_anchor_id)
 BEGIN SELECT RAISE(ABORT,'retired citations cannot support new work'); END;--> statement-breakpoint
CREATE TRIGGER dossier_ai_proposal_anchors_retired_source_guard BEFORE INSERT ON dossier_ai_proposal_anchors
 WHEN EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=NEW.dossier_id AND r.source_anchor_id=NEW.source_anchor_id)
 BEGIN SELECT RAISE(ABORT,'retired citations cannot support new work'); END;--> statement-breakpoint
CREATE TRIGGER dossier_deadline_sources_retired_source_guard BEFORE INSERT ON dossier_deadline_sources
 WHEN EXISTS(SELECT 1 FROM dossier_source_anchor_retirements r WHERE r.dossier_id=NEW.dossier_id AND r.source_anchor_id=NEW.source_anchor_id)
 BEGIN SELECT RAISE(ABORT,'retired citations cannot support new work'); END;--> statement-breakpoint
CREATE TRIGGER dossier_assertions_retired_accept_guard BEFORE UPDATE ON dossier_professional_assertions WHEN NEW.status='accepted' AND OLD.status<>'accepted' AND EXISTS(SELECT 1 FROM dossier_assertion_sources s JOIN dossier_source_anchor_retirements r ON r.dossier_id=s.dossier_id AND r.source_anchor_id=s.source_anchor_id WHERE s.dossier_id=NEW.dossier_id AND s.assertion_id=NEW.id) BEGIN SELECT RAISE(ABORT,'review replacement evidence before accepting the assertion'); END;--> statement-breakpoint
CREATE TRIGGER dossier_snapshots_retired_dependency_guard BEFORE UPDATE ON dossier_snapshots WHEN NEW.sealed=1 AND OLD.sealed=0 AND EXISTS(SELECT 1 FROM dossier_snapshot_assertions a JOIN dossier_assertion_sources s ON s.dossier_id=a.dossier_id AND s.assertion_id=a.assertion_id JOIN dossier_source_anchor_retirements r ON r.dossier_id=s.dossier_id AND r.source_anchor_id=s.source_anchor_id WHERE a.dossier_id=NEW.dossier_id AND a.snapshot_id=NEW.id) BEGIN SELECT RAISE(ABORT,'retired citation dependencies require explicit assertion review before sealing'); END;
