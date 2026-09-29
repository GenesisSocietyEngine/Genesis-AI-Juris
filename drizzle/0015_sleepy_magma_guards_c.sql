CREATE TRIGGER `dossier_governed_outputs_insert_guard`
BEFORE INSERT ON `dossier_governed_outputs`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM `dossier_snapshots` AS snapshot
	JOIN `dossiers` AS dossier ON dossier.`id` = snapshot.`dossier_id`
	WHERE snapshot.`dossier_id` = NEW.`dossier_id`
		AND snapshot.`id` = NEW.`snapshot_id`
		AND snapshot.`sealed` = true
		AND snapshot.`manifest_digest` = NEW.`snapshot_digest`
		AND snapshot.`dossier_revision` = dossier.`revision`
)
BEGIN
	SELECT RAISE(ABORT, 'governed output requires the exact current-revision sealed snapshot digest');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_governed_outputs_initial_state`
AFTER INSERT ON `dossier_governed_outputs`
FOR EACH ROW
BEGIN
	INSERT INTO `dossier_output_state_events` (
		`id`, `dossier_id`, `output_id`, `sequence`, `state`,
		`reason`, `occurred_at`, `actor_ref`
	) VALUES (
		NEW.`id` || ':state:1', NEW.`dossier_id`, NEW.`id`, 1, 'current',
		NULL, NEW.`created_at`, NEW.`created_by_actor_ref`
	);
END;--> statement-breakpoint
CREATE TRIGGER `dossier_governed_outputs_update_guard`
BEFORE UPDATE ON `dossier_governed_outputs`
BEGIN
	SELECT RAISE(ABORT, 'governed outputs are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_governed_outputs_delete_guard`
BEFORE DELETE ON `dossier_governed_outputs`
BEGIN
	SELECT RAISE(ABORT, 'governed outputs are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_output_state_events_insert_guard`
BEFORE INSERT ON `dossier_output_state_events`
FOR EACH ROW
WHEN NOT (
	(NEW.`sequence` = 1 AND NEW.`state` = 'current' AND NOT EXISTS (
		SELECT 1 FROM `dossier_output_state_events`
		WHERE `dossier_id` = NEW.`dossier_id` AND `output_id` = NEW.`output_id`
	))
	OR
	(NEW.`sequence` = 2 AND NEW.`state` = 'stale' AND EXISTS (
		SELECT 1 FROM `dossier_output_state_events`
		WHERE `dossier_id` = NEW.`dossier_id` AND `output_id` = NEW.`output_id`
			AND `sequence` = 1 AND `state` = 'current'
	) AND NOT EXISTS (
		SELECT 1 FROM `dossier_output_state_events`
		WHERE `dossier_id` = NEW.`dossier_id` AND `output_id` = NEW.`output_id` AND `sequence` > 1
	))
)
BEGIN
	SELECT RAISE(ABORT, 'output state history is current then at most one stale receipt');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_output_state_events_update_guard` BEFORE UPDATE ON `dossier_output_state_events` BEGIN SELECT RAISE(ABORT, 'output state history is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_output_state_events_delete_guard` BEFORE DELETE ON `dossier_output_state_events` BEGIN SELECT RAISE(ABORT, 'output state history is immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_output_approvals_insert_guard`
BEFORE INSERT ON `dossier_output_approvals`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM `dossier_participants` AS participant
	JOIN `dossier_output_state_events` AS state
		ON state.`dossier_id` = participant.`dossier_id`
		AND state.`output_id` = NEW.`output_id`
	WHERE participant.`dossier_id` = NEW.`dossier_id`
		AND participant.`id` = NEW.`reviewer_participant_id`
		AND participant.`role` = 'reviewer'
		AND participant.`status` = 'active'
		AND participant.`user_id` = NEW.`reviewer_user_id`
		AND participant.`actor_id` = NEW.`reviewer_actor_ref`
		AND state.`sequence` = 1
		AND state.`state` = 'current'
		AND NOT EXISTS (
			SELECT 1 FROM `dossier_output_state_events` AS later
			WHERE later.`dossier_id` = state.`dossier_id`
				AND later.`output_id` = state.`output_id`
				AND later.`sequence` > state.`sequence`
		)
)
BEGIN
	SELECT RAISE(ABORT, 'output approval requires an active reviewer and current output');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_output_approvals_update_guard` BEFORE UPDATE ON `dossier_output_approvals` BEGIN SELECT RAISE(ABORT, 'output approvals are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_output_approvals_delete_guard` BEFORE DELETE ON `dossier_output_approvals` BEGIN SELECT RAISE(ABORT, 'output approvals are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_decision_packages_insert_guard`
BEFORE INSERT ON `dossier_decision_package_references`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`source_dossier_revision`
	) THEN RAISE(ABORT, 'decision package must bind the current dossier revision') END);
	SELECT (CASE WHEN NEW.`parent_package_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `dossier_decision_package_references`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `package_id` = NEW.`parent_package_id`
			AND `package_version` = NEW.`parent_package_version`
			AND `package_fingerprint` = NEW.`parent_package_fingerprint`
	) THEN RAISE(ABORT, 'decision package parent tuple must match exact governed lineage') END);
END;--> statement-breakpoint
CREATE TRIGGER `dossier_decision_packages_identity_guard`
BEFORE UPDATE ON `dossier_decision_package_references`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`package_id` IS NOT OLD.`package_id`
	OR NEW.`package_version` IS NOT OLD.`package_version`
	OR NEW.`package_fingerprint` IS NOT OLD.`package_fingerprint`
	OR NEW.`parent_package_id` IS NOT OLD.`parent_package_id`
	OR NEW.`parent_package_version` IS NOT OLD.`parent_package_version`
	OR NEW.`parent_package_fingerprint` IS NOT OLD.`parent_package_fingerprint`
	OR NEW.`source_dossier_revision` IS NOT OLD.`source_dossier_revision`
	OR NEW.`graph_digest` IS NOT OLD.`graph_digest`
	OR NEW.`package_type_registry` IS NOT OLD.`package_type_registry`
	OR NEW.`package_type_id` IS NOT OLD.`package_type_id`
	OR NEW.`package_type_version` IS NOT OLD.`package_type_version`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'decision package identity, lineage, and graph provenance are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_decision_packages_source_rebind_guard`
BEFORE UPDATE OF `source_snapshot_id` ON `dossier_decision_package_references`
FOR EACH ROW
WHEN OLD.`source_snapshot_id` IS NOT NULL AND NEW.`source_snapshot_id` IS NOT OLD.`source_snapshot_id`
BEGIN
	SELECT RAISE(ABORT, 'decision package source snapshot cannot be rebound');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_decision_packages_delete_guard`
BEFORE DELETE ON `dossier_decision_package_references`
BEGIN
	SELECT RAISE(ABORT, 'decision package references are governed and cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_decision_packages_snapshot_guard`
BEFORE UPDATE OF `source_snapshot_id` ON `dossier_decision_package_references`
FOR EACH ROW
WHEN NEW.`source_snapshot_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `dossier_snapshots`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`source_snapshot_id`
		AND `sealed` = true
		AND `dossier_revision` = NEW.`source_dossier_revision`
)
BEGIN
	SELECT RAISE(ABORT, 'decision package source snapshot must be sealed');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_decision_packages_snapshot_insert_guard`
BEFORE INSERT ON `dossier_decision_package_references`
FOR EACH ROW
WHEN NEW.`source_snapshot_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `dossier_snapshots`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`source_snapshot_id`
		AND `sealed` = true
		AND `dossier_revision` = NEW.`source_dossier_revision`
)
BEGIN
	SELECT RAISE(ABORT, 'decision package source snapshot must be sealed');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_revision_receipts_insert_guard`
BEFORE INSERT ON `dossier_revision_receipts`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`resulting_revision`
	) THEN RAISE(ABORT, 'dossier revision receipt must bind the resulting live revision') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `dossier_revision` = NEW.`resulting_revision`
	) THEN RAISE(ABORT, 'dossier revision receipt requires at least one exact-revision audit event') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS primary_event
		WHERE primary_event.`dossier_id` = NEW.`dossier_id`
			AND primary_event.`dossier_revision` = NEW.`resulting_revision`
			AND primary_event.`actor_ref` = NEW.`created_by_actor_ref`
			AND primary_event.`sequence` = (
				SELECT MIN(same_revision.`sequence`) FROM `dossier_audit_events` AS same_revision
				WHERE same_revision.`dossier_id` = NEW.`dossier_id`
					AND same_revision.`dossier_revision` = NEW.`resulting_revision`
			)
	) THEN RAISE(ABORT, 'dossier revision receipt actor must match the primary revision audit') END);
	SELECT (CASE WHEN NEW.`resulting_revision` = 1 AND NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `dossier_revision` = 1
			AND `sequence` = 1
			AND `event_type` = 'dossier_created'
			AND `object_ref_type` = 'dossier'
			AND `object_ref_id` = NEW.`dossier_id`
	) THEN RAISE(ABORT, 'revision one receipt requires the exact dossier-created first audit') END);
	SELECT (CASE WHEN EXISTS (
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
	) THEN RAISE(ABORT, 'status revision receipt requires its exact immutable transition audit') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_governed_outputs` AS output
		WHERE output.`dossier_id` = NEW.`dossier_id`
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_output_state_events` AS state
				WHERE state.`dossier_id` = output.`dossier_id`
					AND state.`output_id` = output.`id`
			)
	) THEN RAISE(ABORT, 'every governed output requires an initial state before a revision receipt') END);
	SELECT (CASE WHEN EXISTS (
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
	) THEN RAISE(ABORT, 'dossier revision receipt requires all current outputs stale or one exact approved snapshot workflow') END);
END;--> statement-breakpoint
CREATE TRIGGER `dossier_revision_receipts_update_guard`
BEFORE UPDATE ON `dossier_revision_receipts`
BEGIN
	SELECT RAISE(ABORT, 'dossier revision receipts are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_revision_receipts_delete_guard`
BEFORE DELETE ON `dossier_revision_receipts`
BEGIN
	SELECT RAISE(ABORT, 'dossier revision receipts are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_job_completion_audit_guard`
BEFORE INSERT ON `dossier_audit_events`
FOR EACH ROW
WHEN NEW.`event_type` = 'proposal_generation_completed'
BEGIN
	SELECT (CASE WHEN NEW.`object_ref_type` <> 'dossier'
		OR NEW.`object_ref_id` <> NEW.`dossier_id`
	THEN RAISE(ABORT, 'AI proposal completion audit must target its canonical dossier') END);
	SELECT (CASE WHEN json_valid(NEW.`detail`) <> 1
		OR json_type(NEW.`detail`) <> 'object'
	THEN RAISE(ABORT, 'AI proposal completion audit detail must be bounded metadata') END);
	SELECT (CASE WHEN (
		SELECT COUNT(*) FROM json_each(NEW.`detail`)
	) <> 6 OR EXISTS (
		SELECT 1 FROM json_each(NEW.`detail`)
		WHERE `key` NOT IN (
			'job_id','result_code','candidate_count','analyzed_source_count',
			'analyzed_character_count','model_receipt_digest'
		)
	) THEN RAISE(ABORT, 'AI proposal completion audit detail must use its exact six-key receipt') END);
	SELECT (CASE WHEN json_type(NEW.`detail`, '$.job_id') <> 'text'
		OR json_type(NEW.`detail`, '$.result_code') <> 'text'
		OR json_type(NEW.`detail`, '$.candidate_count') <> 'integer'
		OR json_type(NEW.`detail`, '$.analyzed_source_count') <> 'integer'
		OR json_type(NEW.`detail`, '$.analyzed_character_count') <> 'integer'
		OR json_type(NEW.`detail`, '$.model_receipt_digest') <> 'text'
		OR length(json_extract(NEW.`detail`, '$.model_receipt_digest')) <> 71
		OR substr(json_extract(NEW.`detail`, '$.model_receipt_digest'), 1, 7) <> 'sha256-'
		OR substr(json_extract(NEW.`detail`, '$.model_receipt_digest'), 8) GLOB '*[^0-9a-f]*'
	THEN RAISE(ABORT, 'AI proposal completion audit receipt types or digest are invalid') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS prior
		WHERE prior.`dossier_id` = NEW.`dossier_id`
			AND prior.`event_type` = 'proposal_generation_completed'
			AND json_extract(prior.`detail`, '$.job_id') = json_extract(NEW.`detail`, '$.job_id')
	) THEN RAISE(ABORT, 'AI proposal job has one immutable completion audit') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `dossier_ai_proposal_jobs` AS job
		JOIN `dossiers` AS dossier ON dossier.`id` = job.`dossier_id`
		WHERE job.`dossier_id` = NEW.`dossier_id`
			AND job.`id` = json_extract(NEW.`detail`, '$.job_id')
			AND job.`status` = 'processing'
			AND job.`requested_by_user_id` = NEW.`actor_user_id`
			AND job.`requested_by_actor_ref` = NEW.`actor_ref`
			AND NEW.`dossier_revision` = dossier.`revision`
			AND dossier.`revision` = job.`expected_dossier_revision` + CASE WHEN EXISTS (
				SELECT 1 FROM `dossier_ai_proposals`
				WHERE `dossier_id` = job.`dossier_id` AND `generation_job_id` = job.`id`
			) THEN 1 ELSE 0 END
			AND json_extract(NEW.`detail`, '$.candidate_count') = (
				SELECT COUNT(*) FROM `dossier_ai_proposals`
				WHERE `dossier_id` = job.`dossier_id` AND `generation_job_id` = job.`id`
			)
			AND json_extract(NEW.`detail`, '$.candidate_count') BETWEEN 0 AND 20
			AND json_extract(NEW.`detail`, '$.analyzed_source_count') = (
				SELECT COUNT(*) FROM `dossier_ai_proposal_job_sources`
				WHERE `dossier_id` = job.`dossier_id` AND `job_id` = job.`id`
			)
			AND json_extract(NEW.`detail`, '$.analyzed_source_count') BETWEEN 1 AND 8
			AND json_extract(NEW.`detail`, '$.analyzed_character_count') = (
				SELECT SUM(`context_end` - `context_start`)
				FROM `dossier_ai_proposal_job_sources`
				WHERE `dossier_id` = job.`dossier_id` AND `job_id` = job.`id`
			)
			AND json_extract(NEW.`detail`, '$.analyzed_character_count') BETWEEN 1 AND 96000
			AND json_extract(NEW.`detail`, '$.result_code') = CASE WHEN EXISTS (
				SELECT 1 FROM `dossier_ai_proposals`
				WHERE `dossier_id` = job.`dossier_id` AND `generation_job_id` = job.`id`
			) THEN 'ready_with_candidates' ELSE 'ready_no_candidates' END
			AND NEW.`summary_code` = CASE WHEN EXISTS (
				SELECT 1 FROM `dossier_ai_proposals`
				WHERE `dossier_id` = job.`dossier_id` AND `generation_job_id` = job.`id`
			) THEN 'AI_PROPOSAL_GENERATION_READY' ELSE 'AI_PROPOSAL_GENERATION_NO_CANDIDATES' END
			AND (
				NOT EXISTS (
					SELECT 1 FROM `dossier_ai_proposals`
					WHERE `dossier_id` = job.`dossier_id` AND `generation_job_id` = job.`id`
				)
				OR NOT EXISTS (
					SELECT 1 FROM `dossier_revision_receipts`
					WHERE `dossier_id` = job.`dossier_id`
						AND `resulting_revision` = job.`expected_dossier_revision` + 1
				)
			)
	) THEN RAISE(ABORT, 'AI proposal completion audit must bind the exact in-flight result and analyzed ranges') END);
END;--> statement-breakpoint
CREATE TRIGGER `dossier_audit_events_chain_guard`
BEFORE INSERT ON `dossier_audit_events`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`dossier_revision`
	) THEN RAISE(ABORT, 'dossier audit event must bind the current live revision') END);
	SELECT (CASE WHEN NEW.`actor_role` IN ('owner','contributor','reviewer','viewer') AND NOT EXISTS (
		SELECT 1 FROM `dossier_participants`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `user_id` = NEW.`actor_user_id`
			AND `actor_id` = NEW.`actor_ref`
			AND `role` = NEW.`actor_role`
			AND `status` = 'active'
	) THEN RAISE(ABORT, 'dossier audit actor must be an exact active participant authority') END);
	SELECT (CASE WHEN NEW.`sequence` = 1 AND EXISTS (
		SELECT 1 FROM `dossier_audit_events` WHERE `dossier_id` = NEW.`dossier_id`
	) THEN RAISE(ABORT, 'dossier audit sequence one already exists') END);
	SELECT (CASE WHEN NEW.`sequence` > 1 AND NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS previous
		WHERE previous.`dossier_id` = NEW.`dossier_id`
			AND previous.`id` = NEW.`previous_event_id`
			AND previous.`sequence` = NEW.`sequence` - 1
			AND previous.`sequence` = (
				SELECT MAX(latest.`sequence`) FROM `dossier_audit_events` AS latest
				WHERE latest.`dossier_id` = NEW.`dossier_id`
			)
	) THEN RAISE(ABORT, 'dossier audit event must extend the latest exact predecessor') END);
	SELECT (CASE WHEN NEW.`sequence` = 1 AND (
		NEW.`dossier_revision` <> 1
		OR NEW.`event_type` <> 'dossier_created'
		OR NEW.`object_ref_type` <> 'dossier'
		OR NEW.`object_ref_id` <> NEW.`dossier_id`
	) THEN RAISE(ABORT, 'dossier audit sequence one must be the exact revision-one dossier-created event') END);
	SELECT (CASE WHEN NEW.`sequence` > 1 AND NEW.`event_type` = 'dossier_created'
		THEN RAISE(ABORT, 'dossier-created audit is allowed only at sequence one') END);
	SELECT (CASE WHEN NEW.`sequence` > 1 AND EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS previous
		WHERE previous.`dossier_id` = NEW.`dossier_id`
			AND previous.`id` = NEW.`previous_event_id`
			AND (
				NEW.`dossier_revision` < previous.`dossier_revision`
				OR unixepoch(NEW.`occurred_at`) IS NULL
				OR unixepoch(previous.`occurred_at`) IS NULL
				OR unixepoch(NEW.`occurred_at`) < unixepoch(previous.`occurred_at`)
			)
	) THEN RAISE(ABORT, 'dossier audit revision and occurrence time must be nondecreasing') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'status_transition' AND NOT EXISTS (
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
	) THEN RAISE(ABORT, 'status-transition audit must bind the exact transition revision, actor, time, and event type') END);
	SELECT (CASE WHEN NEW.`event_type` IN ('dossier_status_transitioned','admin_archive_override')
		AND NEW.`object_ref_type` <> 'status_transition'
		THEN RAISE(ABORT, 'transition audit event must reference its exact status transition') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'dossier' AND NEW.`object_ref_id` <> NEW.`dossier_id`
		THEN RAISE(ABORT, 'audit dossier reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'participant' AND NOT EXISTS (SELECT 1 FROM `dossier_participants` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit participant reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'status_transition' AND NOT EXISTS (SELECT 1 FROM `dossier_status_transitions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit transition reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'document' AND NOT EXISTS (SELECT 1 FROM `dossier_documents` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id` AND `is_provisional` = false)
		THEN RAISE(ABORT, 'audit document reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'document_version' AND NOT EXISTS (SELECT 1 FROM `dossier_document_versions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit version reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'source_anchor' AND NOT EXISTS (SELECT 1 FROM `dossier_source_anchors` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit anchor reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'professional_assertion' AND NOT EXISTS (SELECT 1 FROM `dossier_professional_assertions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit assertion reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'evidence_link' AND NOT EXISTS (SELECT 1 FROM `dossier_evidence_links` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit evidence reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'information_request' AND NOT EXISTS (SELECT 1 FROM `dossier_information_requests` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit request reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'deadline_reference' AND NOT EXISTS (SELECT 1 FROM `dossier_deadline_references` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit deadline reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'decision_package_reference' AND NOT EXISTS (SELECT 1 FROM `dossier_decision_package_references` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit package reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'ai_proposal' AND NOT EXISTS (SELECT 1 FROM `dossier_ai_proposals` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit proposal reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'dossier_snapshot' AND NOT EXISTS (SELECT 1 FROM `dossier_snapshots` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id` AND `sealed` = true)
		THEN RAISE(ABORT, 'audit snapshot reference is outside or unsealed') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'governed_output' AND NOT EXISTS (SELECT 1 FROM `dossier_governed_outputs` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit output reference is outside the dossier') END);
	SELECT (CASE WHEN NEW.`object_ref_type` = 'audit_event' AND NOT EXISTS (SELECT 1 FROM `dossier_audit_events` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`object_ref_id`)
		THEN RAISE(ABORT, 'audit event reference is outside the dossier') END);
END;--> statement-breakpoint
CREATE TRIGGER `dossier_audit_events_update_guard`
BEFORE UPDATE ON `dossier_audit_events`
BEGIN
	SELECT RAISE(ABORT, 'dossier audit is append-only');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_audit_events_delete_guard`
BEFORE DELETE ON `dossier_audit_events`
BEGIN
	SELECT RAISE(ABORT, 'dossier audit is append-only');
END;
