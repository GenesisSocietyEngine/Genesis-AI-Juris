CREATE TABLE `dossier_audit_certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`dossier_revision` integer NOT NULL,
	`event_type` text NOT NULL,
	`object_ref_type` text NOT NULL,
	`object_ref_id` text NOT NULL,
	`actor_ref` text NOT NULL,
	`occurred_at` text NOT NULL,
	`audit_event_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`audit_event_id`) REFERENCES `dossier_audit_events`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_audit_certifications_revision_check" CHECK("dossier_audit_certifications"."dossier_revision" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_certifications_scope_uidx` ON `dossier_audit_certifications` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_certifications_tuple_uidx` ON `dossier_audit_certifications` (`dossier_id`,`dossier_revision`,`event_type`,`object_ref_type`,`object_ref_id`,`actor_ref`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `dossier_audit_certifications_event_idx` ON `dossier_audit_certifications` (`dossier_id`,`audit_event_id`);--> statement-breakpoint
CREATE TABLE `dossier_required_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`dossier_revision` integer NOT NULL,
	`claim_phase` text NOT NULL,
	`event_type` text NOT NULL,
	`object_ref_type` text NOT NULL,
	`object_ref_id` text NOT NULL,
	`actor_ref` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`dossier_revision`,`event_type`,`object_ref_type`,`object_ref_id`,`actor_ref`,`occurred_at`) REFERENCES `dossier_audit_certifications`(`dossier_id`,`dossier_revision`,`event_type`,`object_ref_type`,`object_ref_id`,`actor_ref`,`occurred_at`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_required_audits_revision_check" CHECK("dossier_required_audits"."dossier_revision" >= 1),
	CONSTRAINT "dossier_required_audits_phase_check" CHECK("dossier_required_audits"."claim_phase" in ('revision','same_revision'))
);--> statement-breakpoint
CREATE INDEX `dossier_required_audits_revision_idx` ON `dossier_required_audits` (`dossier_id`,`dossier_revision`,`claim_phase`);--> statement-breakpoint
CREATE INDEX `dossier_required_audits_object_idx` ON `dossier_required_audits` (`dossier_id`,`object_ref_type`,`object_ref_id`);--> statement-breakpoint
CREATE TABLE `dossier_revision_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`resulting_revision` integer NOT NULL,
	`actor_ref` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`resulting_revision`) REFERENCES `dossier_revision_receipts`(`dossier_id`,`resulting_revision`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_revision_commitments_revision_check" CHECK("dossier_revision_commitments"."resulting_revision" >= 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_revision_commitments_revision_uidx` ON `dossier_revision_commitments` (`dossier_id`,`resulting_revision`);--> statement-breakpoint
CREATE INDEX `dossier_revision_commitments_created_idx` ON `dossier_revision_commitments` (`dossier_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `dossier_evidence_links` ADD `originating_proposal_id` text;--> statement-breakpoint
CREATE INDEX `dossier_audit_events_mutation_idx` ON `dossier_audit_events` (`dossier_id`,`dossier_revision`,`event_type`,`object_ref_type`,`object_ref_id`,`actor_ref`,`occurred_at`);--> statement-breakpoint

CREATE TRIGGER dossier_audit_certifications_insert_guard
BEFORE INSERT ON dossier_audit_certifications
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM dossier_audit_events
    WHERE dossier_id = NEW.dossier_id
      AND id = NEW.audit_event_id
      AND dossier_revision = NEW.dossier_revision
      AND event_type = NEW.event_type
      AND object_ref_type = NEW.object_ref_type
      AND object_ref_id = NEW.object_ref_id
      AND actor_ref = NEW.actor_ref
      AND occurred_at = NEW.occurred_at
  ) THEN RAISE(ABORT, 'audit certification requires its exact immutable audit event') END;
END;--> statement-breakpoint

CREATE TRIGGER dossier_audit_certifications_update_guard
BEFORE UPDATE ON dossier_audit_certifications
BEGIN
  SELECT RAISE(ABORT, 'dossier audit certifications are append-only');
END;--> statement-breakpoint

CREATE TRIGGER dossier_audit_certifications_delete_guard
BEFORE DELETE ON dossier_audit_certifications
BEGIN
  SELECT RAISE(ABORT, 'dossier audit certifications are append-only');
END;--> statement-breakpoint

CREATE TRIGGER dossier_audit_events_certify_exact_tuple
AFTER INSERT ON dossier_audit_events
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO dossier_audit_certifications (
    id, dossier_id, dossier_revision, event_type, object_ref_type,
    object_ref_id, actor_ref, occurred_at, audit_event_id, created_at
  ) VALUES (
    'audit-cert:' || NEW.id, NEW.dossier_id, NEW.dossier_revision,
    NEW.event_type, NEW.object_ref_type, NEW.object_ref_id,
    NEW.actor_ref, NEW.occurred_at, NEW.id, NEW.occurred_at
  );
END;--> statement-breakpoint

INSERT OR IGNORE INTO dossier_audit_certifications (
  id, dossier_id, dossier_revision, event_type, object_ref_type,
  object_ref_id, actor_ref, occurred_at, audit_event_id, created_at
)
SELECT
  'audit-cert:' || id, dossier_id, dossier_revision, event_type,
  object_ref_type, object_ref_id, actor_ref, occurred_at, id, occurred_at
FROM dossier_audit_events
ORDER BY dossier_id, sequence;--> statement-breakpoint

CREATE TRIGGER dossier_required_audits_update_guard
BEFORE UPDATE ON dossier_required_audits
BEGIN
  SELECT RAISE(ABORT, 'required dossier audit claims are append-only');
END;--> statement-breakpoint

CREATE TRIGGER dossier_required_audits_delete_guard
BEFORE DELETE ON dossier_required_audits
BEGIN
  SELECT RAISE(ABORT, 'required dossier audit claims are append-only');
END;--> statement-breakpoint

CREATE TRIGGER dossier_revision_commitments_update_guard
BEFORE UPDATE ON dossier_revision_commitments
BEGIN
  SELECT RAISE(ABORT, 'dossier revision commitments are append-only');
END;--> statement-breakpoint

CREATE TRIGGER dossier_revision_commitments_delete_guard
BEFORE DELETE ON dossier_revision_commitments
BEGIN
  SELECT RAISE(ABORT, 'dossier revision commitments are append-only');
END;--> statement-breakpoint

CREATE TRIGGER dossier_required_audits_revision_commitment
AFTER INSERT ON dossier_required_audits
FOR EACH ROW
WHEN NEW.claim_phase = 'revision'
BEGIN
  INSERT OR IGNORE INTO dossier_revision_commitments (
    id, dossier_id, resulting_revision, actor_ref, occurred_at
  ) VALUES (
    NEW.dossier_id || ':revision:' || NEW.dossier_revision,
    NEW.dossier_id, NEW.dossier_revision, NEW.actor_ref, NEW.occurred_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_revision_receipts_exact_claim_guard
BEFORE INSERT ON dossier_revision_receipts
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM dossier_revision_commitments
    WHERE dossier_id = NEW.dossier_id
      AND resulting_revision = NEW.resulting_revision
  ) THEN RAISE(ABORT, 'dossier revision receipt requires an exact mutation commitment') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM dossier_required_audits
    WHERE dossier_id = NEW.dossier_id
      AND dossier_revision = NEW.resulting_revision
      AND claim_phase = 'revision'
  ) THEN RAISE(ABORT, 'dossier revision receipt requires at least one exact mutation audit claim') END;
END;--> statement-breakpoint

CREATE TRIGGER dossiers_insert_audit_claim
AFTER INSERT ON dossiers
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.id, 1, 'revision',
    'dossier_created', 'dossier', NEW.id,
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossiers_metadata_audit_claim
AFTER UPDATE OF reference, title, dossier_type_registry, dossier_type_id,
  dossier_type_version, terminology, jurisdictions, classification, priority,
  status_reason, key_deadline_at, key_deadline_timezone
ON dossiers
FOR EACH ROW
WHEN NEW.status IS OLD.status AND (
  NEW.reference IS NOT OLD.reference
  OR NEW.title IS NOT OLD.title
  OR NEW.dossier_type_registry IS NOT OLD.dossier_type_registry
  OR NEW.dossier_type_id IS NOT OLD.dossier_type_id
  OR NEW.dossier_type_version IS NOT OLD.dossier_type_version
  OR NEW.terminology IS NOT OLD.terminology
  OR NEW.jurisdictions IS NOT OLD.jurisdictions
  OR NEW.classification IS NOT OLD.classification
  OR NEW.priority IS NOT OLD.priority
  OR NEW.status_reason IS NOT OLD.status_reason
  OR NEW.key_deadline_at IS NOT OLD.key_deadline_at
  OR NEW.key_deadline_timezone IS NOT OLD.key_deadline_timezone
)
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.id, NEW.revision, 'revision',
    'dossier_updated', 'dossier', NEW.id,
    NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_participants_insert_audit_claim
AFTER INSERT ON dossier_participants
FOR EACH ROW
WHEN NOT (
  NEW.role = 'owner'
  AND NEW.status = 'active'
  AND NEW.user_id = (SELECT owner_user_id FROM dossiers WHERE id = NEW.dossier_id)
  AND NEW.actor_id = (SELECT owner_actor_id FROM dossiers WHERE id = NEW.dossier_id)
  AND (SELECT revision FROM dossiers WHERE id = NEW.dossier_id) = 1
  AND NOT EXISTS (
    SELECT 1 FROM dossier_revision_receipts
    WHERE dossier_id = NEW.dossier_id AND resulting_revision = 1
  )
)
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'participant_changed', 'participant', NEW.id,
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_participants_update_audit_claim
AFTER UPDATE OF display_name, role, status ON dossier_participants
FOR EACH ROW
WHEN NEW.display_name IS NOT OLD.display_name
  OR NEW.role IS NOT OLD.role
  OR NEW.status IS NOT OLD.status
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'participant_changed', 'participant', NEW.id,
    NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_status_transitions_audit_claim
AFTER INSERT ON dossier_status_transitions
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    NEW.revision_after, 'revision',
    CASE WHEN NEW.platform_admin_override = true
      THEN 'admin_archive_override' ELSE 'dossier_status_transitioned' END,
    'status_transition', NEW.id, NEW.actor_ref, NEW.occurred_at
  );
END;--> statement-breakpoint

DROP TRIGGER dossier_documents_finalize_guard;--> statement-breakpoint
DROP TRIGGER dossier_document_versions_external_current_pointer;--> statement-breakpoint
CREATE TRIGGER dossier_document_versions_external_current_pointer
AFTER INSERT ON dossier_document_versions
FOR EACH ROW
WHEN NEW.ordinal = 1 AND (
  SELECT source_origin FROM dossier_documents
  WHERE dossier_id = NEW.dossier_id AND id = NEW.document_id
) IN ('external_reference','import')
BEGIN
  INSERT INTO dossier_document_current_versions (
    dossier_id, document_id, document_version_id, updated_at, updated_by_actor_ref
  ) VALUES (
    NEW.dossier_id, NEW.document_id, NEW.id, NEW.uploaded_at, NEW.uploader_actor_ref
  );
END;--> statement-breakpoint

DROP TRIGGER dossier_document_current_versions_finalize_external_document;--> statement-breakpoint
CREATE TRIGGER dossier_document_current_versions_finalize_external_document
AFTER INSERT ON dossier_document_current_versions
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM dossier_documents
  WHERE dossier_id = NEW.dossier_id
    AND id = NEW.document_id
    AND is_provisional = true
    AND source_origin IN ('external_reference','import')
)
BEGIN
  UPDATE dossier_documents
  SET is_provisional = false,
    updated_at = NEW.updated_at,
    updated_by_actor_ref = NEW.updated_by_actor_ref
  WHERE dossier_id = NEW.dossier_id AND id = NEW.document_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_documents_finalize_guard
BEFORE UPDATE OF is_provisional ON dossier_documents
FOR EACH ROW
WHEN (OLD.is_provisional = false AND NEW.is_provisional <> false)
  OR (OLD.is_provisional = true AND NEW.is_provisional = false AND NOT (
    (
      OLD.source_origin IN ('external_reference','import')
      AND EXISTS (
        SELECT 1 FROM dossier_document_current_versions
        WHERE dossier_id = OLD.dossier_id AND document_id = OLD.id
      )
    )
    OR
    (
      OLD.source_origin = 'internal_upload'
      AND EXISTS (
        SELECT 1
        FROM dossier_document_current_versions AS current_version
        JOIN dossier_document_versions AS version
          ON version.dossier_id = current_version.dossier_id
          AND version.document_id = current_version.document_id
          AND version.id = current_version.document_version_id
        JOIN dossier_upload_intents AS intent
          ON intent.dossier_id = version.dossier_id
          AND intent.id = version.upload_intent_id
        WHERE current_version.dossier_id = OLD.dossier_id
          AND current_version.document_id = OLD.id
          AND intent.state IN ('pending','committed')
      )
    )
  ))
BEGIN
  SELECT RAISE(ABORT, 'provisional document finalization requires its contract-complete current version receipt and cannot reverse');
END;--> statement-breakpoint

CREATE TRIGGER dossier_documents_finalized_metadata_guard
BEFORE UPDATE OF title, document_type, classification, status, tags, external_system_reference
ON dossier_documents
FOR EACH ROW
WHEN OLD.is_provisional = false AND (
  NEW.title IS NOT OLD.title
  OR NEW.document_type IS NOT OLD.document_type
  OR NEW.classification IS NOT OLD.classification
  OR NEW.status IS NOT OLD.status
  OR NEW.tags IS NOT OLD.tags
  OR NEW.external_system_reference IS NOT OLD.external_system_reference
)
BEGIN
  SELECT RAISE(ABORT, 'finalized document metadata mutation is unavailable until its canonical audit workflow is registered');
END;--> statement-breakpoint

CREATE TRIGGER dossier_documents_finalize_audit_claim
AFTER UPDATE OF is_provisional ON dossier_documents
FOR EACH ROW
WHEN OLD.is_provisional = true AND NEW.is_provisional = false
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'document_created', 'document', NEW.id,
    NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_document_versions_insert_audit_claim
AFTER INSERT ON dossier_document_versions
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'document_version_created', 'document_version', NEW.id,
    NEW.uploader_actor_ref, NEW.uploaded_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_document_current_versions_insert_audit_claim
AFTER INSERT ON dossier_document_current_versions
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'document_version_created', 'document_version',
    NEW.document_version_id, NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_document_current_versions_update_audit_claim
AFTER UPDATE OF document_version_id ON dossier_document_current_versions
FOR EACH ROW
WHEN NEW.document_version_id IS NOT OLD.document_version_id
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'document_version_created', 'document_version',
    NEW.document_version_id, NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_source_anchors_insert_audit_claim
AFTER INSERT ON dossier_source_anchors
FOR EACH ROW
WHEN NEW.creator <> 'ai_proposal'
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'source_anchor_reviewed', 'source_anchor', NEW.id,
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_source_anchors_update_audit_claim
AFTER UPDATE OF review_state ON dossier_source_anchors
FOR EACH ROW
WHEN NEW.review_state IS NOT OLD.review_state
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'source_anchor_reviewed', 'source_anchor', NEW.id,
    coalesce(NEW.reviewer_actor_ref, NEW.created_by_actor_ref),
    coalesce(NEW.reviewed_at, NEW.created_at)
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_professional_assertions_insert_audit_claim
AFTER INSERT ON dossier_professional_assertions
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision',
    CASE WHEN NEW.originating_proposal_id IS NULL
      THEN 'assertion_reviewed' ELSE 'proposal_reviewed' END,
    CASE WHEN NEW.originating_proposal_id IS NULL
      THEN 'professional_assertion' ELSE 'ai_proposal' END,
    coalesce(NEW.originating_proposal_id, NEW.id),
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_professional_assertions_update_audit_claim
AFTER UPDATE OF statement, status ON dossier_professional_assertions
FOR EACH ROW
WHEN NEW.statement IS NOT OLD.statement OR NEW.status IS NOT OLD.status
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision',
    CASE WHEN NEW.originating_proposal_id IS NULL
      THEN 'assertion_reviewed' ELSE 'proposal_reviewed' END,
    CASE WHEN NEW.originating_proposal_id IS NULL
      THEN 'professional_assertion' ELSE 'ai_proposal' END,
    coalesce(NEW.originating_proposal_id, NEW.id),
    coalesce(NEW.reviewed_by_actor_ref, NEW.updated_by_actor_ref),
    coalesce(NEW.reviewed_at, NEW.updated_at)
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_assertion_sources_insert_audit_claim
AFTER INSERT ON dossier_assertion_sources
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    dossier.revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossier.revision
    ) THEN 1 ELSE 0 END,
    'revision',
    CASE WHEN assertion.originating_proposal_id IS NULL
      THEN 'assertion_reviewed' ELSE 'proposal_reviewed' END,
    CASE WHEN assertion.originating_proposal_id IS NULL
      THEN 'professional_assertion' ELSE 'ai_proposal' END,
    coalesce(assertion.originating_proposal_id, assertion.id),
    dossier.updated_by_actor_ref, dossier.updated_at
  FROM dossier_professional_assertions AS assertion
  JOIN dossiers AS dossier ON dossier.id = assertion.dossier_id
  WHERE assertion.dossier_id = NEW.dossier_id AND assertion.id = NEW.assertion_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_assertion_sources_delete_audit_claim
AFTER DELETE ON dossier_assertion_sources
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), OLD.dossier_id,
    dossier.revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = OLD.dossier_id AND resulting_revision = dossier.revision
    ) THEN 1 ELSE 0 END,
    'revision',
    CASE WHEN assertion.originating_proposal_id IS NULL
      THEN 'assertion_reviewed' ELSE 'proposal_reviewed' END,
    CASE WHEN assertion.originating_proposal_id IS NULL
      THEN 'professional_assertion' ELSE 'ai_proposal' END,
    coalesce(assertion.originating_proposal_id, assertion.id),
    dossier.updated_by_actor_ref, dossier.updated_at
  FROM dossier_professional_assertions AS assertion
  JOIN dossiers AS dossier ON dossier.id = assertion.dossier_id
  WHERE assertion.dossier_id = OLD.dossier_id AND assertion.id = OLD.assertion_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_evidence_links_proposal_guard
BEFORE INSERT ON dossier_evidence_links
FOR EACH ROW
WHEN NEW.originating_proposal_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM dossier_ai_proposals
  WHERE dossier_id = NEW.dossier_id AND id = NEW.originating_proposal_id
)
BEGIN
  SELECT RAISE(ABORT, 'evidence link proposal origin must belong to the same dossier');
END;--> statement-breakpoint

CREATE TRIGGER dossier_evidence_links_insert_audit_claim
AFTER INSERT ON dossier_evidence_links
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision',
    CASE WHEN NEW.originating_proposal_id IS NULL
      THEN 'evidence_link_changed' ELSE 'proposal_reviewed' END,
    CASE WHEN NEW.originating_proposal_id IS NULL
      THEN 'evidence_link' ELSE 'ai_proposal' END,
    coalesce(NEW.originating_proposal_id, NEW.id),
    NEW.reviewed_by_actor_ref, NEW.reviewed_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_information_requests_insert_audit_claim
AFTER INSERT ON dossier_information_requests
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'information_request_changed', 'information_request', NEW.id,
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_information_requests_update_audit_claim
AFTER UPDATE ON dossier_information_requests
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'information_request_changed', 'information_request', NEW.id,
    NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_deadline_references_unregistered_insert_guard
BEFORE INSERT ON dossier_deadline_references
BEGIN
  SELECT RAISE(ABORT, 'deadline mutation is unavailable until its canonical audit event is registered');
END;--> statement-breakpoint

CREATE TRIGGER dossier_deadline_references_unregistered_update_guard
BEFORE UPDATE ON dossier_deadline_references
BEGIN
  SELECT RAISE(ABORT, 'deadline mutation is unavailable until its canonical audit event is registered');
END;--> statement-breakpoint

CREATE TRIGGER dossier_deadline_sources_unregistered_insert_guard
BEFORE INSERT ON dossier_deadline_sources
BEGIN
  SELECT RAISE(ABORT, 'deadline mutation is unavailable until its canonical audit event is registered');
END;--> statement-breakpoint

CREATE TRIGGER dossier_ai_proposals_insert_audit_claim
AFTER INSERT ON dossier_ai_proposals
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'proposal_reviewed', 'ai_proposal', NEW.id,
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_ai_proposals_update_audit_claim
AFTER UPDATE OF review_state, accepted_object_type, accepted_object_id
ON dossier_ai_proposals
FOR EACH ROW
WHEN NEW.review_state IS NOT OLD.review_state
  OR NEW.accepted_object_type IS NOT OLD.accepted_object_type
  OR NEW.accepted_object_id IS NOT OLD.accepted_object_id
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'proposal_reviewed', 'ai_proposal', NEW.id,
    coalesce(NEW.reviewing_actor_ref, NEW.created_by_actor_ref),
    coalesce(NEW.reviewed_at, NEW.created_at)
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_ai_proposal_versions_insert_audit_claim
AFTER INSERT ON dossier_ai_proposal_versions
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    dossier.revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossier.revision
    ) THEN 1 ELSE 0 END,
    'revision', 'proposal_reviewed', 'ai_proposal',
    NEW.proposal_id, dossier.updated_by_actor_ref, dossier.updated_at
  FROM dossiers AS dossier
  WHERE dossier.id = NEW.dossier_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_ai_proposal_versions_delete_audit_claim
AFTER DELETE ON dossier_ai_proposal_versions
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), OLD.dossier_id,
    dossier.revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = OLD.dossier_id AND resulting_revision = dossier.revision
    ) THEN 1 ELSE 0 END,
    'revision', 'proposal_reviewed', 'ai_proposal',
    OLD.proposal_id, dossier.updated_by_actor_ref, dossier.updated_at
  FROM dossiers AS dossier
  WHERE dossier.id = OLD.dossier_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_ai_proposal_anchors_insert_audit_claim
AFTER INSERT ON dossier_ai_proposal_anchors
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    dossier.revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossier.revision
    ) THEN 1 ELSE 0 END,
    'revision', 'proposal_reviewed', 'ai_proposal',
    NEW.proposal_id, dossier.updated_by_actor_ref, dossier.updated_at
  FROM dossiers AS dossier
  WHERE dossier.id = NEW.dossier_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_ai_proposal_anchors_delete_audit_claim
AFTER DELETE ON dossier_ai_proposal_anchors
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), OLD.dossier_id,
    dossier.revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = OLD.dossier_id AND resulting_revision = dossier.revision
    ) THEN 1 ELSE 0 END,
    'revision', 'proposal_reviewed', 'ai_proposal',
    OLD.proposal_id, dossier.updated_by_actor_ref, dossier.updated_at
  FROM dossiers AS dossier
  WHERE dossier.id = OLD.dossier_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_decision_packages_insert_audit_claim
AFTER INSERT ON dossier_decision_package_references
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'decision_package_linked', 'decision_package_reference', NEW.id,
    NEW.created_by_actor_ref, NEW.created_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_decision_packages_update_audit_claim
AFTER UPDATE ON dossier_decision_package_references
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    (SELECT revision + CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id AND resulting_revision = dossiers.revision
    ) THEN 1 ELSE 0 END FROM dossiers WHERE id = NEW.dossier_id),
    'revision', 'decision_package_linked', 'decision_package_reference', NEW.id,
    NEW.updated_by_actor_ref, NEW.updated_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_snapshots_receipt_before_seal
BEFORE UPDATE OF sealed ON dossier_snapshots
FOR EACH ROW
WHEN OLD.sealed = false AND NEW.sealed = true AND NOT EXISTS (
  SELECT 1 FROM dossier_revision_receipts
  WHERE dossier_id = NEW.dossier_id
    AND resulting_revision = NEW.dossier_revision
)
BEGIN
  SELECT RAISE(ABORT, 'snapshot sealing requires the exact current revision receipt');
END;--> statement-breakpoint

CREATE TRIGGER dossier_snapshots_seal_audit_claim
AFTER UPDATE OF sealed ON dossier_snapshots
FOR EACH ROW
WHEN OLD.sealed = false AND NEW.sealed = true
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  ) VALUES (
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    NEW.dossier_revision, 'same_revision', 'snapshot_created',
    'dossier_snapshot', NEW.id, NEW.sealed_by_actor_ref, NEW.sealed_at
  );
END;--> statement-breakpoint

CREATE TRIGGER dossier_governed_outputs_receipt_guard
BEFORE INSERT ON dossier_governed_outputs
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM dossiers AS dossier
  JOIN dossier_revision_receipts AS receipt
    ON receipt.dossier_id = dossier.id
    AND receipt.resulting_revision = dossier.revision
  WHERE dossier.id = NEW.dossier_id
)
BEGIN
  SELECT RAISE(ABORT, 'governed output generation requires the exact current revision receipt');
END;--> statement-breakpoint

CREATE TRIGGER dossier_governed_outputs_insert_audit_claim
AFTER INSERT ON dossier_governed_outputs
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    dossier.revision, 'same_revision', 'output_generated',
    'governed_output', NEW.id, NEW.created_by_actor_ref, NEW.created_at
  FROM dossiers AS dossier
  WHERE dossier.id = NEW.dossier_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_output_state_events_stale_audit_claim
AFTER INSERT ON dossier_output_state_events
FOR EACH ROW
WHEN NEW.state = 'stale'
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    dossier.revision,
    CASE WHEN EXISTS (
      SELECT 1 FROM dossier_revision_receipts
      WHERE dossier_id = NEW.dossier_id
        AND resulting_revision = dossier.revision
    ) THEN 'same_revision' ELSE 'revision' END,
    'output_marked_stale', 'governed_output', NEW.output_id,
    NEW.actor_ref, NEW.occurred_at
  FROM dossiers AS dossier
  WHERE dossier.id = NEW.dossier_id;
END;--> statement-breakpoint

CREATE TRIGGER dossier_output_approvals_receipt_guard
BEFORE INSERT ON dossier_output_approvals
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM dossiers AS dossier
  JOIN dossier_revision_receipts AS receipt
    ON receipt.dossier_id = dossier.id
    AND receipt.resulting_revision = dossier.revision
  WHERE dossier.id = NEW.dossier_id
)
BEGIN
  SELECT RAISE(ABORT, 'output approval requires the exact current revision receipt');
END;--> statement-breakpoint

CREATE TRIGGER dossier_output_approvals_insert_audit_claim
AFTER INSERT ON dossier_output_approvals
FOR EACH ROW
BEGIN
  INSERT INTO dossier_required_audits (
    id, dossier_id, dossier_revision, claim_phase, event_type,
    object_ref_type, object_ref_id, actor_ref, occurred_at
  )
  SELECT
    'claim:' || lower(hex(randomblob(16))), NEW.dossier_id,
    dossier.revision, 'same_revision', 'output_approved',
    'governed_output', NEW.output_id, NEW.reviewer_actor_ref, NEW.approved_at
  FROM dossiers AS dossier
  WHERE dossier.id = NEW.dossier_id;
END;
