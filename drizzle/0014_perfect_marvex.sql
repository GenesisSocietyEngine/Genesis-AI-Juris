CREATE TABLE `dossier_upload_version_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`upload_intent_id` text NOT NULL,
	`required_state` text DEFAULT 'committed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`upload_intent_id`,`required_state`) REFERENCES `dossier_upload_intents`(`dossier_id`,`id`,`state`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_upload_version_commitments_state_check" CHECK("dossier_upload_version_commitments"."required_state" = 'committed')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_version_commitments_version_uidx` ON `dossier_upload_version_commitments` (`dossier_id`,`document_version_id`);--> statement-breakpoint
CREATE INDEX `dossier_upload_version_commitments_intent_idx` ON `dossier_upload_version_commitments` (`dossier_id`,`upload_intent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_intents_state_scope_uidx` ON `dossier_upload_intents` (`dossier_id`,`id`,`state`);--> statement-breakpoint
INSERT INTO `dossier_upload_version_commitments` (
	`id`,
	`dossier_id`,
	`document_version_id`,
	`upload_intent_id`,
	`required_state`,
	`created_at`
)
SELECT
	'upload-version:' || `dossier_id` || ':' || `id`,
	`dossier_id`,
	`id`,
	`upload_intent_id`,
	'committed',
	`created_at`
FROM `dossier_document_versions`
WHERE `upload_intent_id` IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER `dossier_upload_version_commitments_after_version_insert`
AFTER INSERT ON `dossier_document_versions`
WHEN NEW.`upload_intent_id` IS NOT NULL
BEGIN
	INSERT INTO `dossier_upload_version_commitments` (
		`id`,
		`dossier_id`,
		`document_version_id`,
		`upload_intent_id`,
		`required_state`,
		`created_at`
	) VALUES (
		'upload-version:' || NEW.`dossier_id` || ':' || NEW.`id`,
		NEW.`dossier_id`,
		NEW.`id`,
		NEW.`upload_intent_id`,
		'committed',
		NEW.`created_at`
	);
END;--> statement-breakpoint
CREATE TRIGGER `dossier_upload_version_commitments_immutable_update`
BEFORE UPDATE ON `dossier_upload_version_commitments`
BEGIN
	SELECT RAISE(ABORT, 'dossier_upload_version_commitments rows are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_upload_version_commitments_immutable_delete`
BEFORE DELETE ON `dossier_upload_version_commitments`
BEGIN
	SELECT RAISE(ABORT, 'dossier_upload_version_commitments rows are immutable');
END;--> statement-breakpoint
DROP TRIGGER dossier_source_anchors_insert_audit_claim;--> statement-breakpoint
CREATE TRIGGER dossier_source_anchors_insert_audit_claim
AFTER INSERT ON dossier_source_anchors
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
		'revision', 'source_anchor_reviewed', 'source_anchor', NEW.id,
		NEW.created_by_actor_ref, NEW.created_at
	);
END;--> statement-breakpoint
DROP TRIGGER dossiers_metadata_audit_claim;--> statement-breakpoint
CREATE TRIGGER dossiers_metadata_audit_claim
AFTER UPDATE OF reference, title, dossier_type_registry, dossier_type_id,
	dossier_type_version, terminology, jurisdictions, classification, priority,
	status_reason, key_deadline_at, key_deadline_timezone
ON dossiers
FOR EACH ROW
WHEN (
	NEW.reference IS NOT OLD.reference
	OR NEW.title IS NOT OLD.title
	OR NEW.dossier_type_registry IS NOT OLD.dossier_type_registry
	OR NEW.dossier_type_id IS NOT OLD.dossier_type_id
	OR NEW.dossier_type_version IS NOT OLD.dossier_type_version
	OR NEW.terminology IS NOT OLD.terminology
	OR NEW.jurisdictions IS NOT OLD.jurisdictions
	OR NEW.classification IS NOT OLD.classification
	OR NEW.priority IS NOT OLD.priority
	OR NEW.key_deadline_at IS NOT OLD.key_deadline_at
	OR NEW.key_deadline_timezone IS NOT OLD.key_deadline_timezone
) OR (
	NEW.status IS OLD.status
	AND NEW.status_reason IS NOT OLD.status_reason
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
CREATE TRIGGER dossiers_status_owned_fields_guard
BEFORE UPDATE OF closed_at, closed_by_actor_ref, closure_reason,
	archived_at, archived_by_actor_ref, archive_reason, archive_admin_override
ON dossiers
FOR EACH ROW
WHEN NEW.status IS OLD.status AND (
	NEW.closed_at IS NOT OLD.closed_at
	OR NEW.closed_by_actor_ref IS NOT OLD.closed_by_actor_ref
	OR NEW.closure_reason IS NOT OLD.closure_reason
	OR NEW.archived_at IS NOT OLD.archived_at
	OR NEW.archived_by_actor_ref IS NOT OLD.archived_by_actor_ref
	OR NEW.archive_reason IS NOT OLD.archive_reason
	OR NEW.archive_admin_override IS NOT OLD.archive_admin_override
)
BEGIN
	SELECT RAISE(ABORT, 'closure and archive fields may change only through an exact status transition');
END;--> statement-breakpoint
DROP TRIGGER dossiers_status_transition_guard;--> statement-breakpoint
CREATE TRIGGER dossiers_status_transition_guard
BEFORE UPDATE OF status ON dossiers
FOR EACH ROW
WHEN NEW.status IS NOT OLD.status AND NOT EXISTS (
	SELECT 1 FROM dossier_status_transitions AS transition
	WHERE transition.dossier_id = NEW.id
		AND transition.revision_before = OLD.revision
		AND transition.revision_after = NEW.revision
		AND transition.previous_status = OLD.status
		AND transition.new_status = NEW.status
		AND transition.actor_ref = NEW.updated_by_actor_ref
		AND transition.occurred_at = NEW.updated_at
		AND transition.reason IS NEW.status_reason
		AND (
			(
				NEW.status = 'closed'
				AND NEW.closed_at = transition.occurred_at
				AND NEW.closed_by_actor_ref = transition.actor_ref
				AND NEW.closure_reason IS transition.reason
				AND NEW.archived_at IS OLD.archived_at
				AND NEW.archived_by_actor_ref IS OLD.archived_by_actor_ref
				AND NEW.archive_reason IS OLD.archive_reason
				AND NEW.archive_admin_override IS OLD.archive_admin_override
			)
			OR (
				NEW.status = 'archived'
				AND NEW.archived_at = transition.occurred_at
				AND NEW.archived_by_actor_ref = transition.actor_ref
				AND NEW.archive_reason IS transition.reason
				AND NEW.archive_admin_override = transition.platform_admin_override
				AND NEW.closed_at IS OLD.closed_at
				AND NEW.closed_by_actor_ref IS OLD.closed_by_actor_ref
				AND NEW.closure_reason IS OLD.closure_reason
			)
			OR (
				NEW.status NOT IN ('closed', 'archived')
				AND NEW.closed_at IS OLD.closed_at
				AND NEW.closed_by_actor_ref IS OLD.closed_by_actor_ref
				AND NEW.closure_reason IS OLD.closure_reason
				AND NEW.archived_at IS OLD.archived_at
				AND NEW.archived_by_actor_ref IS OLD.archived_by_actor_ref
				AND NEW.archive_reason IS OLD.archive_reason
				AND NEW.archive_admin_override IS OLD.archive_admin_override
			)
		)
)
BEGIN
	SELECT RAISE(ABORT, 'dossier status changes require exact reason, time, actor, and closure or archive fields');
END;--> statement-breakpoint
DROP TRIGGER dossier_professional_assertions_update_audit_claim;--> statement-breakpoint
CREATE TRIGGER dossier_professional_assertions_update_audit_claim
AFTER UPDATE OF assertion_type, statement, status ON dossier_professional_assertions
FOR EACH ROW
WHEN NEW.assertion_type IS NOT OLD.assertion_type
	OR NEW.statement IS NOT OLD.statement
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
		'revision',
		CASE WHEN (OLD.status = 'accepted' AND NEW.status = 'superseded')
			OR NEW.originating_proposal_id IS NULL
			THEN 'assertion_reviewed' ELSE 'proposal_reviewed' END,
		CASE WHEN (OLD.status = 'accepted' AND NEW.status = 'superseded')
			OR NEW.originating_proposal_id IS NULL
			THEN 'professional_assertion' ELSE 'ai_proposal' END,
		CASE WHEN OLD.status = 'accepted' AND NEW.status = 'superseded'
			THEN NEW.id ELSE coalesce(NEW.originating_proposal_id, NEW.id) END,
		CASE
			WHEN OLD.status = 'accepted' AND NEW.status = 'superseded'
				THEN NEW.updated_by_actor_ref
			ELSE coalesce(NEW.reviewed_by_actor_ref, NEW.updated_by_actor_ref)
		END,
		CASE
			WHEN OLD.status = 'accepted' AND NEW.status = 'superseded'
				THEN NEW.updated_at
			ELSE coalesce(NEW.reviewed_at, NEW.updated_at)
		END
	);
END;--> statement-breakpoint
CREATE TRIGGER dossiers_revision_commitment
AFTER UPDATE OF revision ON dossiers
FOR EACH ROW
WHEN NEW.revision IS NOT OLD.revision
BEGIN
	INSERT OR IGNORE INTO dossier_revision_commitments (
		id, dossier_id, resulting_revision, actor_ref, occurred_at
	) VALUES (
		NEW.id || ':revision:' || NEW.revision,
		NEW.id, NEW.revision, NEW.updated_by_actor_ref, NEW.updated_at
	);
END;--> statement-breakpoint
CREATE TRIGGER dossier_participants_provenance_only_guard
BEFORE UPDATE OF updated_by_actor_ref, updated_at ON dossier_participants
FOR EACH ROW
WHEN (
	NEW.updated_by_actor_ref IS NOT OLD.updated_by_actor_ref
	OR NEW.updated_at IS NOT OLD.updated_at
) AND NEW.display_name IS OLD.display_name
	AND NEW.role IS OLD.role
	AND NEW.status IS OLD.status
BEGIN
	SELECT RAISE(ABORT, 'participant provenance cannot change without a governed participant mutation');
END;--> statement-breakpoint
CREATE TRIGGER dossier_documents_provenance_only_guard
BEFORE UPDATE OF updated_by_actor_ref, updated_at ON dossier_documents
FOR EACH ROW
WHEN (
	NEW.updated_by_actor_ref IS NOT OLD.updated_by_actor_ref
	OR NEW.updated_at IS NOT OLD.updated_at
) AND NEW.title IS OLD.title
	AND NEW.document_type IS OLD.document_type
	AND NEW.classification IS OLD.classification
	AND NEW.status IS OLD.status
	AND NEW.tags IS OLD.tags
	AND NEW.external_system_reference IS OLD.external_system_reference
	AND NEW.is_provisional IS OLD.is_provisional
BEGIN
	SELECT RAISE(ABORT, 'document provenance cannot change without a governed document mutation');
END;--> statement-breakpoint
CREATE TRIGGER dossier_document_current_versions_provenance_only_guard
BEFORE UPDATE OF updated_by_actor_ref, updated_at ON dossier_document_current_versions
FOR EACH ROW
WHEN NEW.document_version_id IS OLD.document_version_id AND (
	NEW.updated_by_actor_ref IS NOT OLD.updated_by_actor_ref
	OR NEW.updated_at IS NOT OLD.updated_at
)
BEGIN
	SELECT RAISE(ABORT, 'current-version provenance cannot change without a new current version');
END;--> statement-breakpoint
CREATE TRIGGER dossier_professional_assertions_provenance_only_guard
BEFORE UPDATE OF updated_by_actor_ref, updated_at ON dossier_professional_assertions
FOR EACH ROW
WHEN (
	NEW.updated_by_actor_ref IS NOT OLD.updated_by_actor_ref
	OR NEW.updated_at IS NOT OLD.updated_at
) AND NEW.assertion_type IS OLD.assertion_type
	AND NEW.statement IS OLD.statement
	AND NEW.status IS OLD.status
BEGIN
	SELECT RAISE(ABORT, 'assertion provenance cannot change without a governed assertion mutation');
END;--> statement-breakpoint
DROP TRIGGER dossier_documents_finalized_metadata_guard;--> statement-breakpoint
CREATE TRIGGER dossier_documents_finalized_metadata_guard
BEFORE UPDATE OF title, document_type, classification, tags, external_system_reference
ON dossier_documents
FOR EACH ROW
WHEN OLD.is_provisional = false AND (
	NEW.title IS NOT OLD.title
	OR NEW.document_type IS NOT OLD.document_type
	OR NEW.classification IS NOT OLD.classification
	OR NEW.tags IS NOT OLD.tags
	OR NEW.external_system_reference IS NOT OLD.external_system_reference
)
BEGIN
	SELECT RAISE(ABORT, 'finalized document metadata mutation is unavailable until its canonical audit workflow is registered');
END;--> statement-breakpoint
CREATE TRIGGER dossier_documents_status_guard
BEFORE UPDATE OF status ON dossier_documents
FOR EACH ROW
WHEN NEW.status IS NOT OLD.status
BEGIN
	SELECT CASE WHEN OLD.is_provisional <> false
		THEN RAISE(ABORT, 'only finalized documents may enter professional review') END;
	SELECT CASE WHEN NOT (
		(OLD.status = 'received' AND NEW.status IN ('under_review','accepted_source','rejected'))
		OR (OLD.status = 'under_review' AND NEW.status IN ('accepted_source','rejected'))
		OR (OLD.status = 'rejected' AND NEW.status = 'under_review')
		OR (OLD.status = 'accepted_source' AND NEW.status = 'superseded')
	) THEN RAISE(ABORT, 'document status transition is not registered') END;
	SELECT CASE WHEN unixepoch(NEW.updated_at) IS NULL OR NEW.updated_at IS OLD.updated_at
		THEN RAISE(ABORT, 'document review requires a new canonical update time') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM dossier_document_current_versions
		WHERE dossier_id = NEW.dossier_id AND document_id = NEW.id
	) THEN RAISE(ABORT, 'document review requires an exact current version') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM dossier_participants
		WHERE dossier_id = NEW.dossier_id
			AND actor_id = NEW.updated_by_actor_ref
			AND role IN ('owner','contributor','reviewer')
			AND status = 'active'
	) THEN RAISE(ABORT, 'document review requires an active professional participant') END;
END;--> statement-breakpoint
CREATE TRIGGER dossier_documents_status_audit_claim
AFTER UPDATE OF status ON dossier_documents
FOR EACH ROW
WHEN NEW.status IS NOT OLD.status
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
		'revision', 'dossier_updated', 'document', NEW.id,
		NEW.updated_by_actor_ref, NEW.updated_at
	);
END;
--> statement-breakpoint
DROP TRIGGER dossier_revision_receipts_exact_claim_guard;
--> statement-breakpoint
CREATE TRIGGER dossier_revision_receipts_exact_claim_guard
BEFORE INSERT ON dossier_revision_receipts
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM dossier_revision_commitments
		WHERE dossier_id = NEW.dossier_id
			AND resulting_revision = NEW.resulting_revision
			AND actor_ref = NEW.created_by_actor_ref
	) THEN RAISE(ABORT, 'dossier revision receipt requires an exact mutation commitment') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM dossier_required_audits
		WHERE dossier_id = NEW.dossier_id
			AND dossier_revision = NEW.resulting_revision
			AND claim_phase = 'revision'
			AND event_type <> 'output_marked_stale'
	) THEN RAISE(ABORT, 'dossier revision receipt requires at least one primary exact mutation audit claim') END;
END;
--> statement-breakpoint
CREATE TRIGGER dossiers_creation_provenance_immutable
BEFORE UPDATE OF id, created_by_actor_ref, created_at ON dossiers
FOR EACH ROW
WHEN NEW.id IS NOT OLD.id
	OR NEW.created_by_actor_ref IS NOT OLD.created_by_actor_ref
	OR NEW.created_at IS NOT OLD.created_at
BEGIN
	SELECT RAISE(ABORT, 'dossier identity and creation provenance are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_professional_assertions_review_state_guard
BEFORE UPDATE OF status ON dossier_professional_assertions
FOR EACH ROW
WHEN OLD.status = 'needs_review'
	AND NEW.status NOT IN ('needs_review','accepted','rejected')
BEGIN
	SELECT RAISE(ABORT, 'pending professional assertions require an explicit accept or reject decision');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_revision_commitments_exact_duplicate_guard
BEFORE INSERT ON dossier_revision_commitments
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM dossier_revision_commitments
	WHERE dossier_id = NEW.dossier_id
		AND resulting_revision = NEW.resulting_revision
		AND (
			actor_ref IS NOT NEW.actor_ref
			OR occurred_at IS NOT NEW.occurred_at
		)
)
BEGIN
	SELECT RAISE(ABORT, 'revision commitment actor and occurrence time must match exactly');
END;
--> statement-breakpoint
DROP TRIGGER dossier_information_requests_update_audit_claim;
--> statement-breakpoint
CREATE TRIGGER dossier_information_requests_update_audit_claim
AFTER UPDATE ON dossier_information_requests
FOR EACH ROW
WHEN NEW.question IS NOT OLD.question
	OR NEW.owner_user_id IS NOT OLD.owner_user_id
	OR NEW.owner_actor_ref IS NOT OLD.owner_actor_ref
	OR NEW.requested_from_participant_id IS NOT OLD.requested_from_participant_id
	OR NEW.priority IS NOT OLD.priority
	OR NEW.due_at IS NOT OLD.due_at
	OR NEW.timezone IS NOT OLD.timezone
	OR NEW.status IS NOT OLD.status
	OR NEW.reason IS NOT OLD.reason
	OR NEW.readiness_reason_code IS NOT OLD.readiness_reason_code
	OR NEW.satisfying_document_id IS NOT OLD.satisfying_document_id
	OR NEW.satisfying_evidence_link_id IS NOT OLD.satisfying_evidence_link_id
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
END;
--> statement-breakpoint
CREATE TRIGGER dossier_information_requests_provenance_only_guard
BEFORE UPDATE OF updated_by_actor_ref, updated_at ON dossier_information_requests
FOR EACH ROW
WHEN (
	NEW.updated_by_actor_ref IS NOT OLD.updated_by_actor_ref
	OR NEW.updated_at IS NOT OLD.updated_at
) AND NEW.question IS OLD.question
	AND NEW.owner_user_id IS OLD.owner_user_id
	AND NEW.owner_actor_ref IS OLD.owner_actor_ref
	AND NEW.requested_from_participant_id IS OLD.requested_from_participant_id
	AND NEW.priority IS OLD.priority
	AND NEW.due_at IS OLD.due_at
	AND NEW.timezone IS OLD.timezone
	AND NEW.status IS OLD.status
	AND NEW.reason IS OLD.reason
	AND NEW.readiness_reason_code IS OLD.readiness_reason_code
	AND NEW.satisfying_document_id IS OLD.satisfying_document_id
	AND NEW.satisfying_evidence_link_id IS OLD.satisfying_evidence_link_id
BEGIN
	SELECT RAISE(ABORT, 'information-request provenance cannot change without a governed mutation');
END;
--> statement-breakpoint
DROP TRIGGER dossier_decision_packages_update_audit_claim;
--> statement-breakpoint
CREATE TRIGGER dossier_decision_packages_update_audit_claim
AFTER UPDATE ON dossier_decision_package_references
FOR EACH ROW
WHEN NEW.source_snapshot_id IS NOT OLD.source_snapshot_id
	OR NEW.state IS NOT OLD.state
	OR NEW.graph_validation_status IS NOT OLD.graph_validation_status
	OR NEW.simulation_run_references IS NOT OLD.simulation_run_references
	OR NEW.approval_state IS NOT OLD.approval_state
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
END;
--> statement-breakpoint
CREATE TRIGGER dossier_decision_packages_provenance_only_guard
BEFORE UPDATE OF updated_by_actor_ref, updated_at ON dossier_decision_package_references
FOR EACH ROW
WHEN (
	NEW.updated_by_actor_ref IS NOT OLD.updated_by_actor_ref
	OR NEW.updated_at IS NOT OLD.updated_at
) AND NEW.source_snapshot_id IS OLD.source_snapshot_id
	AND NEW.state IS OLD.state
	AND NEW.graph_validation_status IS OLD.graph_validation_status
	AND NEW.simulation_run_references IS OLD.simulation_run_references
	AND NEW.approval_state IS OLD.approval_state
BEGIN
	SELECT RAISE(ABORT, 'decision-package provenance cannot change without a governed mutation');
END;
--> statement-breakpoint
CREATE TRIGGER dossiers_status_metadata_separation_guard
BEFORE UPDATE ON dossiers
FOR EACH ROW
WHEN NEW.status IS NOT OLD.status AND (
	NEW.reference IS NOT OLD.reference
	OR NEW.title IS NOT OLD.title
	OR NEW.dossier_type_registry IS NOT OLD.dossier_type_registry
	OR NEW.dossier_type_id IS NOT OLD.dossier_type_id
	OR NEW.dossier_type_version IS NOT OLD.dossier_type_version
	OR NEW.terminology IS NOT OLD.terminology
	OR NEW.owner_user_id IS NOT OLD.owner_user_id
	OR NEW.owner_actor_id IS NOT OLD.owner_actor_id
	OR NEW.organisation_id IS NOT OLD.organisation_id
	OR NEW.jurisdictions IS NOT OLD.jurisdictions
	OR NEW.classification IS NOT OLD.classification
	OR NEW.priority IS NOT OLD.priority
	OR NEW.key_deadline_at IS NOT OLD.key_deadline_at
	OR NEW.key_deadline_timezone IS NOT OLD.key_deadline_timezone
)
BEGIN
	SELECT RAISE(ABORT, 'status transitions cannot piggyback dossier metadata changes');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_audit_events_nonparticipant_role_guard
BEFORE INSERT ON dossier_audit_events
FOR EACH ROW
WHEN NEW.actor_role IN ('system','import')
	OR (
		NEW.actor_role = 'platform_admin'
		AND (
			NEW.event_type <> 'admin_archive_override'
			OR NEW.object_ref_type <> 'status_transition'
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'non-participant audit roles are limited to exact platform-admin archive overrides');
END;
--> statement-breakpoint
CREATE TRIGGER dossiers_canonical_insert_guard
BEFORE INSERT ON dossiers
FOR EACH ROW
WHEN NEW.status <> 'draft'
	OR NEW.revision <> 1
	OR NEW.status_reason IS NOT NULL
	OR NEW.closed_at IS NOT NULL
	OR NEW.closed_by_actor_ref IS NOT NULL
	OR NEW.closure_reason IS NOT NULL
	OR NEW.archived_at IS NOT NULL
	OR NEW.archived_by_actor_ref IS NOT NULL
	OR NEW.archive_reason IS NOT NULL
	OR NEW.archive_admin_override <> false
	OR NEW.owner_actor_id IS NOT NEW.created_by_actor_ref
	OR NEW.updated_by_actor_ref IS NOT NEW.created_by_actor_ref
	OR NEW.updated_at IS NOT NEW.created_at
BEGIN
	SELECT RAISE(ABORT, 'dossiers must begin as a canonical revision-one draft owned by their creator');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_participants_insert_provenance_guard
BEFORE INSERT ON dossier_participants
FOR EACH ROW
WHEN NEW.updated_by_actor_ref IS NOT NEW.created_by_actor_ref
	OR NEW.updated_at IS NOT NEW.created_at
BEGIN
	SELECT RAISE(ABORT, 'participant creation and update provenance must match');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_professional_assertions_insert_provenance_guard
BEFORE INSERT ON dossier_professional_assertions
FOR EACH ROW
WHEN NEW.updated_by_actor_ref IS NOT NEW.created_by_actor_ref
	OR NEW.updated_at IS NOT NEW.created_at
BEGIN
	SELECT RAISE(ABORT, 'assertion creation and update provenance must match');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_information_requests_insert_provenance_guard
BEFORE INSERT ON dossier_information_requests
FOR EACH ROW
WHEN NEW.updated_by_actor_ref IS NOT NEW.created_by_actor_ref
	OR NEW.updated_at IS NOT NEW.created_at
BEGIN
	SELECT RAISE(ABORT, 'information-request creation and update provenance must match');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_decision_packages_insert_provenance_guard
BEFORE INSERT ON dossier_decision_package_references
FOR EACH ROW
WHEN NEW.updated_by_actor_ref IS NOT NEW.created_by_actor_ref
	OR NEW.updated_at IS NOT NEW.created_at
BEGIN
	SELECT RAISE(ABORT, 'decision-package creation and update provenance must match');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_document_versions_insert_provenance_guard
BEFORE INSERT ON dossier_document_versions
FOR EACH ROW
WHEN NEW.created_by_actor_ref IS NOT NEW.uploader_actor_ref
	OR NEW.created_at IS NOT NEW.uploaded_at
	OR (
		NEW.uploader_user_id IS NOT NULL
		AND NOT EXISTS (
			SELECT 1 FROM users
			WHERE id = NEW.uploader_user_id
				AND actor_id = NEW.uploader_actor_ref
		)
	)
	OR (
		NEW.upload_intent_id IS NOT NULL
		AND NOT EXISTS (
			SELECT 1 FROM dossier_upload_intents
			WHERE dossier_id = NEW.dossier_id
				AND id = NEW.upload_intent_id
				AND actor_user_id IS NEW.uploader_user_id
				AND actor_ref = NEW.uploader_actor_ref
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'document-version provenance must match its exact uploader and upload intent');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_evidence_links_insert_provenance_guard
BEFORE INSERT ON dossier_evidence_links
FOR EACH ROW
WHEN NEW.created_by_actor_ref IS NOT NEW.reviewed_by_actor_ref
	OR NEW.created_at IS NOT NEW.reviewed_at
BEGIN
	SELECT RAISE(ABORT, 'evidence-link creation provenance must match its exact review decision');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_participants_insert_mutator_guard
BEFORE INSERT ON dossier_participants
FOR EACH ROW
WHEN NOT (
	NEW.role = 'owner'
	AND NEW.status = 'active'
	AND NOT EXISTS (
		SELECT 1 FROM dossier_participants
		WHERE dossier_id = NEW.dossier_id
	)
	AND EXISTS (
		SELECT 1 FROM dossiers
		WHERE id = NEW.dossier_id
			AND revision = 1
			AND owner_user_id = NEW.user_id
			AND owner_actor_id = NEW.actor_id
			AND created_by_actor_ref = NEW.created_by_actor_ref
	)
) AND NOT EXISTS (
	SELECT 1 FROM dossier_participants
	WHERE dossier_id = NEW.dossier_id
		AND actor_id = NEW.created_by_actor_ref
		AND role = 'owner'
		AND status = 'active'
)
BEGIN
	SELECT RAISE(ABORT, 'participant creation requires pre-existing active owner authority');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_participants_update_mutator_guard
BEFORE UPDATE ON dossier_participants
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM dossier_participants
	WHERE dossier_id = OLD.dossier_id
		AND actor_id = NEW.updated_by_actor_ref
		AND role = 'owner'
		AND status = 'active'
)
BEGIN
	SELECT RAISE(ABORT, 'participant changes require pre-existing active owner authority');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_professional_assertions_review_provenance_guard
BEFORE UPDATE ON dossier_professional_assertions
FOR EACH ROW
WHEN OLD.status = 'needs_review'
	AND NEW.status IN ('accepted','rejected')
	AND (
		NEW.updated_by_actor_ref IS NOT NEW.reviewed_by_actor_ref
		OR NEW.updated_at IS NOT NEW.reviewed_at
	)
BEGIN
	SELECT RAISE(ABORT, 'assertion review provenance must match the exact reviewer and review time');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_assertion_sources_insert_provenance_guard
BEFORE INSERT ON dossier_assertion_sources
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM dossiers
	WHERE id = NEW.dossier_id
		AND updated_at = NEW.created_at
)
BEGIN
	SELECT RAISE(ABORT, 'assertion-source creation time must match the live dossier mutation');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_decision_packages_insert_revision_phase_guard
BEFORE INSERT ON dossier_decision_package_references
FOR EACH ROW
WHEN NEW.updated_by_actor_ref IS NEW.created_by_actor_ref
	AND NEW.updated_at IS NEW.created_at
	AND EXISTS (
		SELECT 1
		FROM dossiers
		JOIN dossier_revision_receipts
			ON dossier_revision_receipts.dossier_id = dossiers.id
			AND dossier_revision_receipts.resulting_revision = dossiers.revision
		WHERE dossiers.id = NEW.dossier_id
	)
BEGIN
	SELECT RAISE(ABORT, 'decision-package creation requires an unreceipted live dossier revision');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_snapshots_pilot_redaction_insert_guard
BEFORE INSERT ON dossier_snapshots
FOR EACH ROW
WHEN NEW.audience <> 'internal'
	OR NEW.redaction_profile_id <> 'pilot-default'
BEGIN
	SELECT RAISE(ABORT, 'pilot snapshots require internal audience and pilot-default redaction profile');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_snapshots_insert_canonical_state_guard
BEFORE INSERT ON dossier_snapshots
FOR EACH ROW
WHEN NEW.sealed IS NOT false
	OR NEW.sealed_at IS NOT NULL
	OR NEW.sealed_by_actor_ref IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'snapshot creation must begin unsealed');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_snapshots_pilot_redaction_seal_guard
BEFORE UPDATE OF sealed ON dossier_snapshots
FOR EACH ROW
WHEN OLD.sealed = false
	AND NEW.sealed = true
	AND (
		NEW.audience <> 'internal'
		OR NEW.redaction_profile_id <> 'pilot-default'
	)
BEGIN
	SELECT RAISE(ABORT, 'pilot snapshots require internal audience and pilot-default redaction profile');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_governed_outputs_pilot_redaction_guard
BEFORE INSERT ON dossier_governed_outputs
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM dossier_snapshots
	WHERE dossier_id = NEW.dossier_id
		AND id = NEW.snapshot_id
		AND audience = 'internal'
		AND redaction_profile_id = 'pilot-default'
)
BEGIN
	SELECT RAISE(ABORT, 'governed output requires an internal pilot-default snapshot');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_documents_insert_canonical_state_guard
BEFORE INSERT ON dossier_documents
FOR EACH ROW
WHEN NEW.status <> 'received'
BEGIN
	SELECT RAISE(ABORT, 'logical document creation must begin in received status');
END;
