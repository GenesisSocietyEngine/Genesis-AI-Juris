DROP TRIGGER dossier_revision_receipts_insert_guard;--> statement-breakpoint
DROP TRIGGER dossier_audit_events_chain_guard;--> statement-breakpoint
DROP TRIGGER dossiers_status_transition_guard;--> statement-breakpoint
CREATE TABLE `__new_dossier_status_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`revision_before` integer NOT NULL,
	`revision_after` integer NOT NULL,
	`previous_status` text NOT NULL,
	`new_status` text NOT NULL,
	`approved_output_id` text,
	`actor_user_id` integer,
	`actor_ref` text NOT NULL,
	`actor_role` text NOT NULL,
	`occurred_at` text NOT NULL,
	`reason` text,
	`comment` text,
	`platform_admin_override` integer DEFAULT false NOT NULL,
	`had_current_output` integer DEFAULT false NOT NULL,
	`had_reviewer_approval` integer DEFAULT false NOT NULL,
	`consequences` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`approved_output_id`) REFERENCES `dossier_governed_outputs`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_status_transitions_revision_check" CHECK("__new_dossier_status_transitions"."revision_before" >= 1 and "__new_dossier_status_transitions"."revision_after" = "__new_dossier_status_transitions"."revision_before" + 1),
	CONSTRAINT "dossier_status_transitions_previous_check" CHECK("__new_dossier_status_transitions"."previous_status" in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')),
	CONSTRAINT "dossier_status_transitions_new_check" CHECK("__new_dossier_status_transitions"."new_status" in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')),
	CONSTRAINT "dossier_status_transitions_approved_output_check" CHECK(("__new_dossier_status_transitions"."new_status" = 'output_approved') = ("__new_dossier_status_transitions"."approved_output_id" is not null)),
	CONSTRAINT "dossier_status_transitions_role_check" CHECK("__new_dossier_status_transitions"."actor_role" in ('owner','contributor','reviewer','viewer','platform_admin'))
);
--> statement-breakpoint
INSERT INTO `__new_dossier_status_transitions`("id", "dossier_id", "revision_before", "revision_after", "previous_status", "new_status", "approved_output_id", "actor_user_id", "actor_ref", "actor_role", "occurred_at", "reason", "comment", "platform_admin_override", "had_current_output", "had_reviewer_approval", "consequences") SELECT "id", "dossier_id", "revision_before", "revision_after", "previous_status", "new_status", "approved_output_id", "actor_user_id", "actor_ref", "actor_role", "occurred_at", "reason", "comment", "platform_admin_override", "had_current_output", "had_reviewer_approval", "consequences" FROM `dossier_status_transitions`;--> statement-breakpoint
DROP TABLE `dossier_status_transitions`;--> statement-breakpoint
ALTER TABLE `__new_dossier_status_transitions` RENAME TO `dossier_status_transitions`;--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_transitions_scope_uidx` ON `dossier_status_transitions` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_transitions_revision_uidx` ON `dossier_status_transitions` (`dossier_id`,`revision_after`);--> statement-breakpoint
CREATE INDEX `dossier_status_transitions_dossier_occurred_idx` ON `dossier_status_transitions` (`dossier_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `dossier_status_transitions_approved_output_idx` ON `dossier_status_transitions` (`dossier_id`,`approved_output_id`,`revision_after`);--> statement-breakpoint
CREATE TABLE `dossier_status_application_certifications` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`transition_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`transition_id`) REFERENCES `dossier_status_transitions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_application_certifications_scope_uidx` ON `dossier_status_application_certifications` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_application_certifications_transition_uidx` ON `dossier_status_application_certifications` (`dossier_id`,`transition_id`);--> statement-breakpoint
CREATE INDEX `dossier_status_application_certifications_created_idx` ON `dossier_status_application_certifications` (`dossier_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_status_application_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`transition_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`transition_id`) REFERENCES `dossier_status_transitions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`transition_id`) REFERENCES `dossier_status_application_certifications`(`dossier_id`,`transition_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_application_commitments_scope_uidx` ON `dossier_status_application_commitments` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_application_commitments_transition_uidx` ON `dossier_status_application_commitments` (`dossier_id`,`transition_id`);--> statement-breakpoint
CREATE INDEX `dossier_status_application_commitments_created_idx` ON `dossier_status_application_commitments` (`dossier_id`,`created_at`);
--> statement-breakpoint
INSERT INTO dossier_status_application_certifications (
	id, dossier_id, transition_id, created_at
)
SELECT
	'status-application:' || transition.dossier_id || ':' || transition.id,
	transition.dossier_id,
	transition.id,
	transition.occurred_at
FROM dossier_status_transitions AS transition
JOIN dossiers AS dossier ON dossier.id = transition.dossier_id
	AND dossier.revision = transition.revision_after
	AND dossier.status = transition.new_status
	AND dossier.updated_by_actor_ref = transition.actor_ref
	AND dossier.updated_at = transition.occurred_at
	AND dossier.status_reason IS transition.reason
WHERE (
	transition.new_status = 'closed'
	AND dossier.closed_at = transition.occurred_at
	AND dossier.closed_by_actor_ref = transition.actor_ref
	AND dossier.closure_reason IS transition.reason
) OR (
	transition.new_status = 'archived'
	AND dossier.archived_at = transition.occurred_at
	AND dossier.archived_by_actor_ref = transition.actor_ref
	AND dossier.archive_reason IS transition.reason
	AND dossier.archive_admin_override = transition.platform_admin_override
) OR transition.new_status NOT IN ('closed','archived');
--> statement-breakpoint
INSERT INTO dossier_status_application_commitments (
	id, dossier_id, transition_id, created_at
)
SELECT
	'status-application-commitment:' || dossier_id || ':' || id,
	dossier_id,
	id,
	occurred_at
FROM dossier_status_transitions;
--> statement-breakpoint
CREATE TRIGGER dossier_status_application_certifications_insert_guard
BEFORE INSERT ON dossier_status_application_certifications
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM dossier_status_transitions AS transition
		JOIN dossiers AS dossier ON dossier.id = transition.dossier_id
			AND dossier.revision = transition.revision_after
			AND dossier.status = transition.new_status
			AND dossier.updated_by_actor_ref = transition.actor_ref
			AND dossier.updated_at = transition.occurred_at
			AND dossier.status_reason IS transition.reason
		WHERE transition.dossier_id = NEW.dossier_id
			AND transition.id = NEW.transition_id
			AND (
				(
					transition.new_status = 'closed'
					AND dossier.closed_at = transition.occurred_at
					AND dossier.closed_by_actor_ref = transition.actor_ref
					AND dossier.closure_reason IS transition.reason
				)
				OR (
					transition.new_status = 'archived'
					AND dossier.archived_at = transition.occurred_at
					AND dossier.archived_by_actor_ref = transition.actor_ref
					AND dossier.archive_reason IS transition.reason
					AND dossier.archive_admin_override = transition.platform_admin_override
				)
				OR transition.new_status NOT IN ('closed','archived')
			)
	) THEN RAISE(ABORT, 'status application certification must bind the exact applied transition') END;
END;
--> statement-breakpoint
CREATE TRIGGER dossier_status_application_certifications_update_guard
BEFORE UPDATE ON dossier_status_application_certifications
BEGIN
	SELECT RAISE(ABORT, 'status application certifications are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_status_application_certifications_delete_guard
BEFORE DELETE ON dossier_status_application_certifications
BEGIN
	SELECT RAISE(ABORT, 'status application certifications are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_status_application_commitments_update_guard
BEFORE UPDATE ON dossier_status_application_commitments
BEGIN
	SELECT RAISE(ABORT, 'status application commitments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_status_application_commitments_delete_guard
BEFORE DELETE ON dossier_status_application_commitments
BEGIN
	SELECT RAISE(ABORT, 'status application commitments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_status_application_commitment_after_transition_insert
AFTER INSERT ON dossier_status_transitions
FOR EACH ROW
BEGIN
	INSERT INTO dossier_status_application_commitments (
		id, dossier_id, transition_id, created_at
	) VALUES (
		'status-application-commitment:' || NEW.dossier_id || ':' || NEW.id,
		NEW.dossier_id, NEW.id, NEW.occurred_at
	);
END;
--> statement-breakpoint
CREATE TRIGGER dossiers_status_application_certification
AFTER UPDATE OF status ON dossiers
FOR EACH ROW
WHEN NEW.status IS NOT OLD.status
BEGIN
	INSERT INTO dossier_status_application_certifications (
		id, dossier_id, transition_id, created_at
	)
	SELECT
		'status-application:' || transition.dossier_id || ':' || transition.id,
		transition.dossier_id,
		transition.id,
		NEW.updated_at
	FROM dossier_status_transitions AS transition
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
			)
			OR (
				NEW.status = 'archived'
				AND NEW.archived_at = transition.occurred_at
				AND NEW.archived_by_actor_ref = transition.actor_ref
				AND NEW.archive_reason IS transition.reason
				AND NEW.archive_admin_override = transition.platform_admin_override
			)
			OR NEW.status NOT IN ('closed','archived')
		);
END;
--> statement-breakpoint
CREATE TABLE `dossier_proposal_materialization_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`required_state` text DEFAULT 'accepted' NOT NULL,
	`accepted_object_type` text NOT NULL,
	`accepted_object_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`proposal_id`,`required_state`,`accepted_object_type`,`accepted_object_id`) REFERENCES `dossier_ai_proposals`(`dossier_id`,`id`,`review_state`,`accepted_object_type`,`accepted_object_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_proposal_materialization_commitments_state_check" CHECK("dossier_proposal_materialization_commitments"."required_state" = 'accepted'),
	CONSTRAINT "dossier_proposal_materialization_commitments_type_check" CHECK("dossier_proposal_materialization_commitments"."accepted_object_type" in ('professional_assertion','evidence_link'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_proposal_materialization_commitments_scope_uidx` ON `dossier_proposal_materialization_commitments` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_proposal_materialization_commitments_proposal_uidx` ON `dossier_proposal_materialization_commitments` (`dossier_id`,`proposal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_proposal_materialization_commitments_object_uidx` ON `dossier_proposal_materialization_commitments` (`dossier_id`,`accepted_object_type`,`accepted_object_id`);--> statement-breakpoint
CREATE INDEX `dossier_proposal_materialization_commitments_created_idx` ON `dossier_proposal_materialization_commitments` (`dossier_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposals_materialization_uidx` ON `dossier_ai_proposals` (`dossier_id`,`id`,`review_state`,`accepted_object_type`,`accepted_object_id`);
--> statement-breakpoint
CREATE TABLE __dossier_proposal_materialization_backfill_guard (
	valid integer NOT NULL,
	CONSTRAINT dossier_proposal_materialization_backfill_guard_check CHECK(valid = 1)
);
--> statement-breakpoint
INSERT INTO __dossier_proposal_materialization_backfill_guard (valid)
SELECT 0
FROM dossier_professional_assertions AS assertion
WHERE assertion.originating_proposal_id IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM dossier_ai_proposals AS proposal
		WHERE proposal.dossier_id = assertion.dossier_id
			AND proposal.id = assertion.originating_proposal_id
			AND proposal.review_state = 'accepted'
			AND proposal.accepted_object_type = 'professional_assertion'
			AND proposal.accepted_object_id = assertion.id
			AND proposal.proposal_type IN ('fact','authority_rule','contradiction','assumption','dated_event')
			AND assertion.assertion_type = CASE proposal.proposal_type
				WHEN 'fact' THEN 'fact'
				WHEN 'authority_rule' THEN 'rule'
				WHEN 'contradiction' THEN 'contradiction'
				WHEN 'assumption' THEN 'assumption'
				WHEN 'dated_event' THEN 'date'
			END
			AND assertion.status IN ('accepted','superseded')
			AND assertion.created_by_actor_ref = proposal.reviewing_actor_ref
			AND assertion.created_at = proposal.reviewed_at
			AND assertion.reviewed_by_user_id = proposal.reviewing_user_id
			AND assertion.reviewed_by_actor_ref = proposal.reviewing_actor_ref
			AND assertion.reviewed_at = proposal.reviewed_at
			AND NOT EXISTS (
				SELECT 1 FROM dossier_assertion_sources AS assertion_source
				WHERE assertion_source.dossier_id = assertion.dossier_id
					AND assertion_source.assertion_id = assertion.id
					AND NOT EXISTS (
						SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
						WHERE proposal_source.dossier_id = proposal.dossier_id
							AND proposal_source.proposal_id = proposal.id
							AND proposal_source.source_anchor_id = assertion_source.source_anchor_id
					)
			)
			AND NOT EXISTS (
				SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
				WHERE proposal_source.dossier_id = proposal.dossier_id
					AND proposal_source.proposal_id = proposal.id
					AND NOT EXISTS (
						SELECT 1 FROM dossier_assertion_sources AS assertion_source
						WHERE assertion_source.dossier_id = assertion.dossier_id
							AND assertion_source.assertion_id = assertion.id
							AND assertion_source.source_anchor_id = proposal_source.source_anchor_id
					)
			)
	);
--> statement-breakpoint
INSERT INTO __dossier_proposal_materialization_backfill_guard (valid)
SELECT 0
FROM dossier_evidence_links AS evidence
WHERE evidence.originating_proposal_id IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM dossier_ai_proposals AS proposal
		WHERE proposal.dossier_id = evidence.dossier_id
			AND proposal.id = evidence.originating_proposal_id
			AND proposal.proposal_type = 'evidence_link'
			AND proposal.review_state = 'accepted'
			AND proposal.accepted_object_type = 'evidence_link'
			AND proposal.accepted_object_id = evidence.id
			AND evidence.created_by_actor_ref = proposal.reviewing_actor_ref
			AND evidence.created_at = proposal.reviewed_at
			AND evidence.reviewed_by_user_id = proposal.reviewing_user_id
			AND evidence.reviewed_by_actor_ref = proposal.reviewing_actor_ref
			AND evidence.reviewed_at = proposal.reviewed_at
			AND EXISTS (
				SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
				WHERE proposal_source.dossier_id = proposal.dossier_id
					AND proposal_source.proposal_id = proposal.id
					AND proposal_source.source_anchor_id = evidence.source_anchor_id
			)
	);
--> statement-breakpoint
INSERT INTO __dossier_proposal_materialization_backfill_guard (valid)
SELECT 0
FROM dossier_ai_proposals AS proposal
WHERE proposal.review_state = 'accepted'
	AND NOT (
		(
			proposal.accepted_object_type = 'professional_assertion'
			AND proposal.proposal_type IN ('fact','authority_rule','contradiction','assumption','dated_event')
			AND EXISTS (
				SELECT 1 FROM dossier_professional_assertions AS assertion
				WHERE assertion.dossier_id = proposal.dossier_id
					AND assertion.id = proposal.accepted_object_id
					AND assertion.originating_proposal_id = proposal.id
					AND assertion.status IN ('accepted','superseded')
					AND assertion.assertion_type = CASE proposal.proposal_type
						WHEN 'fact' THEN 'fact'
						WHEN 'authority_rule' THEN 'rule'
						WHEN 'contradiction' THEN 'contradiction'
						WHEN 'assumption' THEN 'assumption'
						WHEN 'dated_event' THEN 'date'
					END
					AND assertion.created_by_actor_ref = proposal.reviewing_actor_ref
					AND assertion.created_at = proposal.reviewed_at
					AND assertion.reviewed_by_user_id = proposal.reviewing_user_id
					AND assertion.reviewed_by_actor_ref = proposal.reviewing_actor_ref
					AND assertion.reviewed_at = proposal.reviewed_at
					AND NOT EXISTS (
						SELECT 1 FROM dossier_assertion_sources AS assertion_source
						WHERE assertion_source.dossier_id = assertion.dossier_id
							AND assertion_source.assertion_id = assertion.id
							AND NOT EXISTS (
								SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
								WHERE proposal_source.dossier_id = proposal.dossier_id
									AND proposal_source.proposal_id = proposal.id
									AND proposal_source.source_anchor_id = assertion_source.source_anchor_id
							)
					)
					AND NOT EXISTS (
						SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
						WHERE proposal_source.dossier_id = proposal.dossier_id
							AND proposal_source.proposal_id = proposal.id
							AND NOT EXISTS (
								SELECT 1 FROM dossier_assertion_sources AS assertion_source
								WHERE assertion_source.dossier_id = assertion.dossier_id
									AND assertion_source.assertion_id = assertion.id
									AND assertion_source.source_anchor_id = proposal_source.source_anchor_id
							)
					)
			)
		)
		OR (
			proposal.accepted_object_type = 'evidence_link'
			AND proposal.proposal_type = 'evidence_link'
			AND EXISTS (
				SELECT 1 FROM dossier_evidence_links AS evidence
				WHERE evidence.dossier_id = proposal.dossier_id
					AND evidence.id = proposal.accepted_object_id
					AND evidence.originating_proposal_id = proposal.id
					AND evidence.created_by_actor_ref = proposal.reviewing_actor_ref
					AND evidence.created_at = proposal.reviewed_at
					AND evidence.reviewed_by_user_id = proposal.reviewing_user_id
					AND evidence.reviewed_by_actor_ref = proposal.reviewing_actor_ref
					AND evidence.reviewed_at = proposal.reviewed_at
					AND EXISTS (
						SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
						WHERE proposal_source.dossier_id = proposal.dossier_id
							AND proposal_source.proposal_id = proposal.id
							AND proposal_source.source_anchor_id = evidence.source_anchor_id
					)
			)
		)
		OR (
			proposal.accepted_object_type = 'decision_package_reference'
			AND proposal.proposal_type = 'graph_change'
			AND EXISTS (
				SELECT 1 FROM dossier_decision_package_references AS package
				WHERE package.dossier_id = proposal.dossier_id
					AND package.id = proposal.accepted_object_id
					AND package.state = 'current'
					AND package.graph_validation_status = 'valid'
					AND package.approval_state = 'published'
					AND json_valid(proposal.proposed_value)
					AND json_extract(proposal.proposed_value, '$.kind') = 'genesis-juris-decision-package-graph-diff-v1'
					AND json_extract(proposal.proposed_value, '$.schema_version') = 1
					AND json_extract(proposal.proposed_value, '$.target.package_id') = package.package_id
					AND json_extract(proposal.proposed_value, '$.target.package_version') = package.package_version
					AND json_extract(proposal.proposed_value, '$.target.package_fingerprint') = package.package_fingerprint
					AND json_extract(proposal.proposed_value, '$.target.graph_digest') = package.graph_digest
					AND json_extract(proposal.proposed_value, '$.target.parent_package_id') IS package.parent_package_id
					AND json_extract(proposal.proposed_value, '$.target.parent_package_version') IS package.parent_package_version
					AND json_extract(proposal.proposed_value, '$.target.parent_package_fingerprint') IS package.parent_package_fingerprint
			)
		)
	);
--> statement-breakpoint
DROP TABLE __dossier_proposal_materialization_backfill_guard;
--> statement-breakpoint
INSERT INTO dossier_proposal_materialization_commitments (
	id, dossier_id, proposal_id, required_state,
	accepted_object_type, accepted_object_id, created_at
)
SELECT
	'proposal-materialization:' || dossier_id || ':' || originating_proposal_id,
	dossier_id, originating_proposal_id, 'accepted',
	'professional_assertion', id, created_at
FROM dossier_professional_assertions
WHERE originating_proposal_id IS NOT NULL
UNION ALL
SELECT
	'proposal-materialization:' || dossier_id || ':' || originating_proposal_id,
	dossier_id, originating_proposal_id, 'accepted',
	'evidence_link', id, created_at
FROM dossier_evidence_links
WHERE originating_proposal_id IS NOT NULL;
--> statement-breakpoint
CREATE TRIGGER dossier_proposal_materialization_commitments_update_guard
BEFORE UPDATE ON dossier_proposal_materialization_commitments
BEGIN
	SELECT RAISE(ABORT, 'proposal materialization commitments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_proposal_materialization_commitments_delete_guard
BEFORE DELETE ON dossier_proposal_materialization_commitments
BEGIN
	SELECT RAISE(ABORT, 'proposal materialization commitments are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER dossier_professional_assertions_materialization_commitment
AFTER INSERT ON dossier_professional_assertions
FOR EACH ROW
WHEN NEW.originating_proposal_id IS NOT NULL
BEGIN
	INSERT INTO dossier_proposal_materialization_commitments (
		id, dossier_id, proposal_id, required_state,
		accepted_object_type, accepted_object_id, created_at
	) VALUES (
		'proposal-materialization:' || NEW.dossier_id || ':' || NEW.originating_proposal_id,
		NEW.dossier_id, NEW.originating_proposal_id, 'accepted',
		'professional_assertion', NEW.id, NEW.created_at
	);
END;
--> statement-breakpoint
CREATE TRIGGER dossier_evidence_links_materialization_commitment
AFTER INSERT ON dossier_evidence_links
FOR EACH ROW
WHEN NEW.originating_proposal_id IS NOT NULL
BEGIN
	INSERT INTO dossier_proposal_materialization_commitments (
		id, dossier_id, proposal_id, required_state,
		accepted_object_type, accepted_object_id, created_at
	) VALUES (
		'proposal-materialization:' || NEW.dossier_id || ':' || NEW.originating_proposal_id,
		NEW.dossier_id, NEW.originating_proposal_id, 'accepted',
		'evidence_link', NEW.id, NEW.created_at
	);
END;
--> statement-breakpoint
CREATE TRIGGER dossier_ai_proposals_strict_accept_guard
BEFORE UPDATE ON dossier_ai_proposals
FOR EACH ROW
WHEN NEW.review_state = 'accepted'
BEGIN
	SELECT CASE WHEN NOT (
		(
			NEW.accepted_object_type = 'professional_assertion'
			AND NEW.proposal_type IN ('fact','authority_rule','contradiction','assumption','dated_event')
			AND EXISTS (
				SELECT 1 FROM dossier_professional_assertions AS assertion
				WHERE assertion.dossier_id = NEW.dossier_id
					AND assertion.id = NEW.accepted_object_id
					AND assertion.originating_proposal_id = NEW.id
					AND assertion.status = 'accepted'
					AND assertion.assertion_type = CASE NEW.proposal_type
						WHEN 'fact' THEN 'fact'
						WHEN 'authority_rule' THEN 'rule'
						WHEN 'contradiction' THEN 'contradiction'
						WHEN 'assumption' THEN 'assumption'
						WHEN 'dated_event' THEN 'date'
					END
					AND assertion.created_by_actor_ref = NEW.reviewing_actor_ref
					AND assertion.created_at = NEW.reviewed_at
					AND assertion.reviewed_by_user_id = NEW.reviewing_user_id
					AND assertion.reviewed_by_actor_ref = NEW.reviewing_actor_ref
					AND assertion.reviewed_at = NEW.reviewed_at
					AND assertion.updated_by_actor_ref = NEW.reviewing_actor_ref
					AND assertion.updated_at = NEW.reviewed_at
					AND NOT EXISTS (
						SELECT 1 FROM dossier_assertion_sources AS assertion_source
						WHERE assertion_source.dossier_id = assertion.dossier_id
							AND assertion_source.assertion_id = assertion.id
							AND NOT EXISTS (
								SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
								WHERE proposal_source.dossier_id = NEW.dossier_id
									AND proposal_source.proposal_id = NEW.id
									AND proposal_source.source_anchor_id = assertion_source.source_anchor_id
							)
					)
					AND NOT EXISTS (
						SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
						WHERE proposal_source.dossier_id = NEW.dossier_id
							AND proposal_source.proposal_id = NEW.id
							AND NOT EXISTS (
								SELECT 1 FROM dossier_assertion_sources AS assertion_source
								WHERE assertion_source.dossier_id = assertion.dossier_id
									AND assertion_source.assertion_id = assertion.id
									AND assertion_source.source_anchor_id = proposal_source.source_anchor_id
							)
					)
			)
		)
		OR (
			NEW.accepted_object_type = 'evidence_link'
			AND NEW.proposal_type = 'evidence_link'
			AND EXISTS (
				SELECT 1 FROM dossier_evidence_links AS evidence
				WHERE evidence.dossier_id = NEW.dossier_id
					AND evidence.id = NEW.accepted_object_id
					AND evidence.originating_proposal_id = NEW.id
					AND evidence.created_by_actor_ref = NEW.reviewing_actor_ref
					AND evidence.created_at = NEW.reviewed_at
					AND evidence.reviewed_by_user_id = NEW.reviewing_user_id
					AND evidence.reviewed_by_actor_ref = NEW.reviewing_actor_ref
					AND evidence.reviewed_at = NEW.reviewed_at
					AND EXISTS (
						SELECT 1 FROM dossier_ai_proposal_anchors AS proposal_source
						WHERE proposal_source.dossier_id = NEW.dossier_id
							AND proposal_source.proposal_id = NEW.id
							AND proposal_source.source_anchor_id = evidence.source_anchor_id
					)
			)
		)
		OR (
			NEW.accepted_object_type = 'decision_package_reference'
			AND NEW.proposal_type = 'graph_change'
			AND EXISTS (
				SELECT 1 FROM dossier_decision_package_references AS package
				WHERE package.dossier_id = NEW.dossier_id
					AND package.id = NEW.accepted_object_id
					AND package.state = 'current'
					AND package.graph_validation_status = 'valid'
					AND package.approval_state = 'published'
					AND json_valid(NEW.proposed_value)
					AND json_extract(NEW.proposed_value, '$.kind') = 'genesis-juris-decision-package-graph-diff-v1'
					AND json_extract(NEW.proposed_value, '$.schema_version') = 1
					AND json_extract(NEW.proposed_value, '$.target.package_id') = package.package_id
					AND json_extract(NEW.proposed_value, '$.target.package_version') = package.package_version
					AND json_extract(NEW.proposed_value, '$.target.package_fingerprint') = package.package_fingerprint
					AND json_extract(NEW.proposed_value, '$.target.graph_digest') = package.graph_digest
					AND json_extract(NEW.proposed_value, '$.target.parent_package_id') IS package.parent_package_id
					AND json_extract(NEW.proposed_value, '$.target.parent_package_version') IS package.parent_package_version
					AND json_extract(NEW.proposed_value, '$.target.parent_package_fingerprint') IS package.parent_package_fingerprint
			)
		)
	) THEN RAISE(ABORT, 'AI proposal acceptance must use an exact registered authoritative materialization') END;
END;
--> statement-breakpoint
CREATE TRIGGER dossier_status_transitions_insert_guard
BEFORE INSERT ON dossier_status_transitions
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM dossiers
		WHERE id = NEW.dossier_id
			AND revision = NEW.revision_before
			AND status = NEW.previous_status
	) THEN RAISE(ABORT, 'status transition must bind the exact live previous revision and status') END;
	SELECT CASE WHEN NEW.occurred_at IS NULL OR unixepoch(NEW.occurred_at) IS NULL
		THEN RAISE(ABORT, 'status transition requires a valid occurrence timestamp') END;
	SELECT CASE WHEN NEW.reason IS NOT NULL
		AND (length(trim(NEW.reason)) < 1 OR length(NEW.reason) > 1000)
		THEN RAISE(ABORT, 'status transition reason is invalid') END;
	SELECT CASE WHEN NEW.actor_role <> 'platform_admin' AND NOT (
		(NEW.previous_status = 'draft' AND NEW.new_status = 'intake_review' AND NEW.actor_role IN ('owner','contributor'))
		OR (NEW.previous_status = 'draft' AND NEW.new_status = 'declined' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'draft' AND NEW.new_status = 'cancelled' AND NEW.actor_role = 'owner')
		OR (NEW.previous_status = 'intake_review' AND NEW.new_status = 'draft' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'intake_review' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'intake_review' AND NEW.new_status = 'awaiting_input' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'intake_review' AND NEW.new_status = 'declined' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'intake_review' AND NEW.new_status = 'cancelled' AND NEW.actor_role = 'owner')
		OR (NEW.previous_status = 'active' AND NEW.new_status = 'awaiting_input' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'active' AND NEW.new_status = 'internal_review' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'active' AND NEW.new_status = 'closed' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'active' AND NEW.new_status = 'cancelled' AND NEW.actor_role = 'owner')
		OR (NEW.previous_status = 'awaiting_input' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'awaiting_input' AND NEW.new_status = 'internal_review' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'awaiting_input' AND NEW.new_status = 'cancelled' AND NEW.actor_role = 'owner')
		OR (NEW.previous_status = 'internal_review' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'internal_review' AND NEW.new_status = 'awaiting_input' AND NEW.actor_role IN ('owner','contributor','reviewer'))
		OR (NEW.previous_status = 'internal_review' AND NEW.new_status = 'output_approved' AND NEW.actor_role = 'reviewer')
		OR (NEW.previous_status = 'internal_review' AND NEW.new_status = 'closed' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'output_approved' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'output_approved' AND NEW.new_status = 'closed' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'output_approved' AND NEW.new_status = 'cancelled' AND NEW.actor_role = 'owner')
		OR (NEW.previous_status = 'closed' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'closed' AND NEW.new_status = 'archived' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'declined' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'declined' AND NEW.new_status = 'archived' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'cancelled' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'cancelled' AND NEW.new_status = 'archived' AND NEW.actor_role IN ('owner','reviewer'))
		OR (NEW.previous_status = 'archived' AND NEW.new_status = 'active' AND NEW.actor_role IN ('owner','reviewer'))
	) THEN RAISE(ABORT, 'status transition edge or role is forbidden by the V1 registry') END;
	SELECT CASE WHEN NEW.actor_role = 'platform_admin' AND NOT (
		NEW.previous_status <> 'archived'
		AND NEW.new_status = 'archived'
		AND NEW.platform_admin_override = true
	) THEN RAISE(ABORT, 'platform admin is limited to the governed archive override') END;
	SELECT CASE WHEN NEW.actor_role <> 'platform_admin' AND NEW.platform_admin_override <> false
		THEN RAISE(ABORT, 'participant transitions cannot claim platform-admin override') END;
	SELECT CASE WHEN (
		NEW.actor_role = 'platform_admin'
		OR NOT (
			(NEW.previous_status = 'draft' AND NEW.new_status = 'intake_review')
			OR (NEW.previous_status = 'intake_review' AND NEW.new_status IN ('draft','active'))
			OR (NEW.previous_status = 'awaiting_input' AND NEW.new_status = 'active')
			OR (NEW.previous_status = 'internal_review' AND NEW.new_status IN ('active','output_approved'))
		)
	) AND length(trim(COALESCE(NEW.reason, ''))) = 0
	THEN RAISE(ABORT, 'status transition reason is required by the V1 registry') END;
	SELECT CASE WHEN NOT json_valid(NEW.consequences)
		OR (NEW.new_status = 'output_approved' AND json(NEW.consequences) <> json('["recompute_readiness","preserve_current_output"]'))
		OR (NEW.new_status <> 'output_approved' AND json(NEW.consequences) <> json('["recompute_readiness","mark_outputs_stale"]'))
	THEN RAISE(ABORT, 'status transition consequences must exactly match the V1 registry') END;
	SELECT CASE WHEN NEW.actor_role IN ('owner','contributor','reviewer','viewer') AND NOT EXISTS (
		SELECT 1 FROM dossier_participants
		WHERE dossier_id = NEW.dossier_id
			AND user_id = NEW.actor_user_id
			AND actor_id = NEW.actor_ref
			AND role = NEW.actor_role
			AND status = 'active'
	) THEN RAISE(ABORT, 'status transition actor must be an exact active participant authority') END;
	SELECT CASE WHEN NEW.actor_role = 'platform_admin' AND NOT EXISTS (
		SELECT 1 FROM users WHERE id = NEW.actor_user_id AND actor_id = NEW.actor_ref
	) THEN RAISE(ABORT, 'platform-admin archive override must bind a stable user actor') END;
	SELECT CASE WHEN NEW.had_current_output <> EXISTS (
		SELECT 1 FROM dossier_governed_outputs AS output
		JOIN dossier_output_state_events AS state
			ON state.dossier_id = output.dossier_id AND state.output_id = output.id
		WHERE output.dossier_id = NEW.dossier_id
			AND state.state = 'current'
			AND state.sequence = (
				SELECT MAX(later.sequence) FROM dossier_output_state_events AS later
				WHERE later.dossier_id = state.dossier_id AND later.output_id = state.output_id
			)
	) THEN RAISE(ABORT, 'status transition current-output fact is not authoritative') END;
	SELECT CASE WHEN NEW.had_reviewer_approval <> EXISTS (
		SELECT 1 FROM dossier_governed_outputs AS output
		JOIN dossier_output_state_events AS state
			ON state.dossier_id = output.dossier_id AND state.output_id = output.id
		JOIN dossier_output_approvals AS approval
			ON approval.dossier_id = output.dossier_id AND approval.output_id = output.id
		WHERE output.dossier_id = NEW.dossier_id
			AND state.state = 'current'
			AND state.sequence = (
				SELECT MAX(later.sequence) FROM dossier_output_state_events AS later
				WHERE later.dossier_id = state.dossier_id AND later.output_id = state.output_id
			)
	) THEN RAISE(ABORT, 'status transition reviewer-approval fact is not authoritative') END;
	SELECT CASE WHEN NEW.new_status = 'output_approved' AND NOT EXISTS (
		SELECT 1
		FROM dossier_governed_outputs AS output
		JOIN dossier_output_state_events AS state
			ON state.dossier_id = output.dossier_id AND state.output_id = output.id
		JOIN dossier_output_approvals AS approval
			ON approval.dossier_id = output.dossier_id AND approval.output_id = output.id
		WHERE output.dossier_id = NEW.dossier_id
			AND output.id = NEW.approved_output_id
			AND approval.reviewer_user_id = NEW.actor_user_id
			AND approval.reviewer_actor_ref = NEW.actor_ref
			AND state.state = 'current'
			AND state.sequence = (
				SELECT MAX(later.sequence) FROM dossier_output_state_events AS later
				WHERE later.dossier_id = state.dossier_id AND later.output_id = state.output_id
			)
	) THEN RAISE(ABORT, 'output approval transition must bind the exact current output and its reviewer') END;
END;--> statement-breakpoint
CREATE TRIGGER dossier_status_transitions_update_guard
BEFORE UPDATE ON dossier_status_transitions
BEGIN
	SELECT RAISE(ABORT, 'dossier status transitions are append-only');
END;--> statement-breakpoint
CREATE TRIGGER dossier_status_transitions_delete_guard
BEFORE DELETE ON dossier_status_transitions
BEGIN
	SELECT RAISE(ABORT, 'dossier status transitions are append-only');
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
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_revision_receipts_insert_guard`
BEFORE INSERT ON `dossier_revision_receipts`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`resulting_revision`
	) THEN RAISE(ABORT, 'dossier revision receipt must bind the resulting live revision') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `dossier_revision` = NEW.`resulting_revision`
	) THEN RAISE(ABORT, 'dossier revision receipt requires at least one exact-revision audit event') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS primary_event
		WHERE primary_event.`dossier_id` = NEW.`dossier_id`
			AND primary_event.`dossier_revision` = NEW.`resulting_revision`
			AND primary_event.`actor_ref` = NEW.`created_by_actor_ref`
			AND primary_event.`sequence` = (
				SELECT MIN(same_revision.`sequence`) FROM `dossier_audit_events` AS same_revision
				WHERE same_revision.`dossier_id` = NEW.`dossier_id`
					AND same_revision.`dossier_revision` = NEW.`resulting_revision`
			)
	) THEN RAISE(ABORT, 'dossier revision receipt actor must match the primary revision audit') END;
	SELECT CASE WHEN NEW.`resulting_revision` = 1 AND NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `dossier_revision` = 1
			AND `sequence` = 1
			AND `event_type` = 'dossier_created'
			AND `object_ref_type` = 'dossier'
			AND `object_ref_id` = NEW.`dossier_id`
	) THEN RAISE(ABORT, 'revision one receipt requires the exact dossier-created first audit') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_status_transitions` AS transition
		WHERE transition.`dossier_id` = NEW.`dossier_id`
			AND transition.`revision_after` = NEW.`resulting_revision`
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_audit_events` AS event
				WHERE event.`dossier_id` = transition.`dossier_id`
					AND event.`dossier_revision` = transition.`revision_after`
					AND event.`object_ref_type` = 'status_transition'
					AND event.`object_ref_id` = transition.`id`
					AND event.`event_type` = CASE
						WHEN transition.`platform_admin_override` = true THEN 'admin_archive_override'
						ELSE 'dossier_status_transitioned'
					END
			)
	) THEN RAISE(ABORT, 'status revision receipt requires its exact immutable transition audit') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_governed_outputs` AS output
		WHERE output.`dossier_id` = NEW.`dossier_id`
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_output_state_events` AS state
				WHERE state.`dossier_id` = output.`dossier_id`
					AND state.`output_id` = output.`id`
			)
	) THEN RAISE(ABORT, 'every governed output requires an initial state before a revision receipt') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1
		FROM `dossier_governed_outputs` AS current_output
		JOIN `dossier_output_state_events` AS current_state
			ON current_state.`dossier_id` = current_output.`dossier_id`
			AND current_state.`output_id` = current_output.`id`
		WHERE current_output.`dossier_id` = NEW.`dossier_id`
			AND current_state.`state` = 'current'
			AND current_state.`sequence` = (
				SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
				WHERE later.`dossier_id` = current_state.`dossier_id`
					AND later.`output_id` = current_state.`output_id`
			)
	) AND NOT EXISTS (
		SELECT 1
		FROM `dossier_status_transitions` AS transition
		JOIN `dossier_governed_outputs` AS approved_output
			ON approved_output.`dossier_id` = transition.`dossier_id`
			AND approved_output.`id` = transition.`approved_output_id`
		JOIN `dossier_output_state_events` AS approved_state
			ON approved_state.`dossier_id` = approved_output.`dossier_id`
			AND approved_state.`output_id` = approved_output.`id`
		JOIN `dossier_output_approvals` AS approval
			ON approval.`dossier_id` = approved_output.`dossier_id`
			AND approval.`output_id` = approved_output.`id`
		WHERE transition.`dossier_id` = NEW.`dossier_id`
			AND transition.`revision_after` = NEW.`resulting_revision`
			AND transition.`new_status` = 'output_approved'
			AND transition.`actor_ref` = NEW.`created_by_actor_ref`
			AND transition.`had_current_output` = true
			AND transition.`had_reviewer_approval` = true
			AND approved_state.`state` = 'current'
			AND approved_state.`sequence` = (
				SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
				WHERE later.`dossier_id` = approved_state.`dossier_id`
					AND later.`output_id` = approved_state.`output_id`
			)
			AND NOT EXISTS (
				SELECT 1
				FROM `dossier_governed_outputs` AS other_output
				JOIN `dossier_output_state_events` AS other_state
					ON other_state.`dossier_id` = other_output.`dossier_id`
					AND other_state.`output_id` = other_output.`id`
				WHERE other_output.`dossier_id` = NEW.`dossier_id`
					AND other_state.`state` = 'current'
					AND other_state.`sequence` = (
						SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
						WHERE later.`dossier_id` = other_state.`dossier_id`
							AND later.`output_id` = other_state.`output_id`
					)
					AND other_output.`snapshot_id` <> approved_output.`snapshot_id`
			)
	) THEN RAISE(ABORT, 'dossier revision receipt requires all current outputs stale or one exact approved snapshot workflow') END;
END;--> statement-breakpoint
--> statement-breakpoint
CREATE TRIGGER `dossier_audit_events_chain_guard`
BEFORE INSERT ON `dossier_audit_events`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`dossier_revision`
	) THEN RAISE(ABORT, 'dossier audit event must bind the current live revision') END;
	SELECT CASE WHEN NEW.`actor_role` IN ('owner','contributor','reviewer','viewer') AND NOT EXISTS (
		SELECT 1 FROM `dossier_participants`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `user_id` = NEW.`actor_user_id`
			AND `actor_id` = NEW.`actor_ref`
			AND `role` = NEW.`actor_role`
			AND `status` = 'active'
	) THEN RAISE(ABORT, 'dossier audit actor must be an exact active participant authority') END;
	SELECT CASE WHEN NEW.`sequence` = 1 AND EXISTS (
		SELECT 1 FROM `dossier_audit_events` WHERE `dossier_id` = NEW.`dossier_id`
	) THEN RAISE(ABORT, 'dossier audit sequence one already exists') END;
	SELECT CASE WHEN NEW.`sequence` > 1 AND NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS previous
		WHERE previous.`dossier_id` = NEW.`dossier_id`
			AND previous.`id` = NEW.`previous_event_id`
			AND previous.`sequence` = NEW.`sequence` - 1
			AND previous.`sequence` = (
				SELECT MAX(latest.`sequence`) FROM `dossier_audit_events` AS latest
				WHERE latest.`dossier_id` = NEW.`dossier_id`
			)
	) THEN RAISE(ABORT, 'dossier audit event must extend the latest exact predecessor') END;
	SELECT CASE WHEN NEW.`sequence` = 1 AND (
		NEW.`dossier_revision` <> 1
		OR NEW.`event_type` <> 'dossier_created'
		OR NEW.`object_ref_type` <> 'dossier'
		OR NEW.`object_ref_id` <> NEW.`dossier_id`
	) THEN RAISE(ABORT, 'dossier audit sequence one must be the exact revision-one dossier-created event') END;
	SELECT CASE WHEN NEW.`sequence` > 1 AND NEW.`event_type` = 'dossier_created'
		THEN RAISE(ABORT, 'dossier-created audit is allowed only at sequence one') END;
	SELECT CASE WHEN NEW.`sequence` > 1 AND EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS previous
		WHERE previous.`dossier_id` = NEW.`dossier_id`
			AND previous.`id` = NEW.`previous_event_id`
			AND (
				NEW.`dossier_revision` < previous.`dossier_revision`
				OR unixepoch(NEW.`occurred_at`) IS NULL
				OR unixepoch(previous.`occurred_at`) IS NULL
				OR unixepoch(NEW.`occurred_at`) < unixepoch(previous.`occurred_at`)
			)
	) THEN RAISE(ABORT, 'dossier audit revision and occurrence time must be nondecreasing') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'status_transition' AND NOT EXISTS (
		SELECT 1 FROM `dossier_status_transitions` AS transition
		WHERE transition.`dossier_id` = NEW.`dossier_id`
			AND transition.`id` = NEW.`object_ref_id`
			AND transition.`revision_after` = NEW.`dossier_revision`
			AND transition.`actor_user_id` IS NEW.`actor_user_id`
			AND transition.`actor_ref` = NEW.`actor_ref`
			AND transition.`actor_role` = NEW.`actor_role`
			AND transition.`occurred_at` = NEW.`occurred_at`
			AND NEW.`event_type` = CASE
				WHEN transition.`platform_admin_override` = true THEN 'admin_archive_override'
				ELSE 'dossier_status_transitioned'
			END
	) THEN RAISE(ABORT, 'status-transition audit must bind the exact transition revision, actor, time, and event type') END;
	SELECT CASE WHEN NEW.`event_type` IN ('dossier_status_transitioned','admin_archive_override')
		AND NEW.`object_ref_type` <> 'status_transition'
		THEN RAISE(ABORT, 'transition audit event must reference its exact status transition') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'dossier' AND NEW.`object_ref_id` <> NEW.`dossier_id`
		THEN RAISE(ABORT, 'audit dossier reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'participant' AND NOT EXISTS (SELECT 1 FROM `dossier_participants` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit participant reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'status_transition' AND NOT EXISTS (SELECT 1 FROM `dossier_status_transitions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit transition reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'document' AND NOT EXISTS (SELECT 1 FROM `dossier_documents` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id` AND `is_provisional` = false)
		THEN RAISE(ABORT, 'audit document reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'document_version' AND NOT EXISTS (SELECT 1 FROM `dossier_document_versions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit version reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'source_anchor' AND NOT EXISTS (SELECT 1 FROM `dossier_source_anchors` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit anchor reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'professional_assertion' AND NOT EXISTS (SELECT 1 FROM `dossier_professional_assertions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit assertion reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'evidence_link' AND NOT EXISTS (SELECT 1 FROM `dossier_evidence_links` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit evidence reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'information_request' AND NOT EXISTS (SELECT 1 FROM `dossier_information_requests` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit request reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'deadline_reference' AND NOT EXISTS (SELECT 1 FROM `dossier_deadline_references` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit deadline reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'decision_package_reference' AND NOT EXISTS (SELECT 1 FROM `dossier_decision_package_references` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit package reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'ai_proposal' AND NOT EXISTS (SELECT 1 FROM `dossier_ai_proposals` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit proposal reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'dossier_snapshot' AND NOT EXISTS (SELECT 1 FROM `dossier_snapshots` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id` AND `sealed` = true)
		THEN RAISE(ABORT, 'audit snapshot reference is outside or unsealed') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'governed_output' AND NOT EXISTS (SELECT 1 FROM `dossier_governed_outputs` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit output reference is outside the dossier') END;
	SELECT CASE WHEN NEW.`object_ref_type` = 'audit_event' AND NOT EXISTS (SELECT 1 FROM `dossier_audit_events` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit event reference is outside the dossier') END;
END;--> statement-breakpoint
--> statement-breakpoint
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
