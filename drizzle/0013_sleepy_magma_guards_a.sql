CREATE TRIGGER `users_actor_id_insert_guard`
BEFORE INSERT ON `users`
FOR EACH ROW
WHEN NEW.`actor_id` IS NOT NULL AND (
	length(NEW.`actor_id`) <> 38
	OR substr(NEW.`actor_id`, 1, 6) <> 'actor_'
	OR substr(NEW.`actor_id`, 7) GLOB '*[^0-9a-f]*'
)
BEGIN
	SELECT RAISE(ABORT, 'user actor id must be an opaque server-resolved identity');
END;
--> statement-breakpoint
CREATE TRIGGER `users_actor_id_fill`
AFTER INSERT ON `users`
FOR EACH ROW
WHEN NEW.`actor_id` IS NULL
BEGIN
	UPDATE `users`
	SET `actor_id` = 'actor_' || lower(hex(randomblob(16)))
	WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `users_actor_id_update_guard`
BEFORE UPDATE OF `actor_id` ON `users`
FOR EACH ROW
WHEN OLD.`actor_id` IS NOT NULL
	OR NEW.`actor_id` IS NULL
	OR length(NEW.`actor_id`) <> 38
	OR substr(NEW.`actor_id`, 1, 6) <> 'actor_'
	OR substr(NEW.`actor_id`, 7) GLOB '*[^0-9a-f]*'
BEGIN
	SELECT RAISE(ABORT, 'user actor id is immutable and server-resolved');
END;
--> statement-breakpoint
-- Every authoritative dossier mutation advances the optimistic revision once.
CREATE TRIGGER `dossiers_revision_guard`
BEFORE UPDATE ON `dossiers`
FOR EACH ROW
WHEN NEW.`revision` <> OLD.`revision` + 1
BEGIN
	SELECT RAISE(ABORT, 'dossier revision must advance exactly once');
END;
--> statement-breakpoint
CREATE TRIGGER `dossiers_owner_transfer_guard`
BEFORE UPDATE OF `owner_user_id`, `owner_actor_id` ON `dossiers`
FOR EACH ROW
WHEN NEW.`owner_user_id` IS NOT OLD.`owner_user_id`
	OR NEW.`owner_actor_id` IS NOT OLD.`owner_actor_id`
BEGIN
	SELECT RAISE(ABORT, 'dossier ownership transfer requires a governed workflow');
END;
--> statement-breakpoint
CREATE TRIGGER `dossiers_delete_guard`
BEFORE DELETE ON `dossiers`
BEGIN
	SELECT RAISE(ABORT, 'governed dossiers cannot be hard-deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossiers_owner_participant_create`
AFTER INSERT ON `dossiers`
FOR EACH ROW
BEGIN
	INSERT INTO `dossier_participants` (
		`id`, `dossier_id`, `user_id`, `actor_id`, `display_name`, `role`, `status`,
		`created_by_actor_ref`, `updated_by_actor_ref`
	) VALUES (
		lower(hex(randomblob(16))), NEW.`id`, NEW.`owner_user_id`, NEW.`owner_actor_id`,
		COALESCE((SELECT `display_name` FROM `users` WHERE `id` = NEW.`owner_user_id`), 'Owner'),
		'owner', 'active', NEW.`created_by_actor_ref`, NEW.`created_by_actor_ref`
	);
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_participants_owner_insert_guard`
BEFORE INSERT ON `dossier_participants`
FOR EACH ROW
WHEN (NEW.`role` = 'owner' AND NEW.`status` = 'active') <> (
	NEW.`user_id` = (SELECT `owner_user_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
	AND NEW.`actor_id` = (SELECT `owner_actor_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
)
BEGIN
	SELECT RAISE(ABORT, 'dossier owner participant must match the server-owned dossier owner');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_participants_owner_update_guard`
BEFORE UPDATE OF `user_id`, `actor_id`, `role`, `status` ON `dossier_participants`
FOR EACH ROW
WHEN (NEW.`role` = 'owner' AND NEW.`status` = 'active') <> (
	NEW.`user_id` = (SELECT `owner_user_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
	AND NEW.`actor_id` = (SELECT `owner_actor_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
)
BEGIN
	SELECT RAISE(ABORT, 'dossier owner participant must match the server-owned dossier owner');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_participants_identity_guard`
BEFORE UPDATE ON `dossier_participants`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`user_id` IS NOT OLD.`user_id`
	OR NEW.`actor_id` IS NOT OLD.`actor_id`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'participant identity and authority binding are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_participants_owner_delete_guard`
BEFORE DELETE ON `dossier_participants`
FOR EACH ROW
WHEN OLD.`role` = 'owner' AND OLD.`status` = 'active'
BEGIN
	SELECT RAISE(ABORT, 'active dossier owner participant cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_participants_delete_guard`
BEFORE DELETE ON `dossier_participants`
BEGIN
	SELECT RAISE(ABORT, 'dossier participants must be removed, not hard-deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossiers_output_approved_guard`
BEFORE UPDATE OF `status` ON `dossiers`
FOR EACH ROW
WHEN NEW.`status` = 'output_approved' AND OLD.`status` <> 'output_approved'
	AND NOT EXISTS (
		SELECT 1
		FROM `dossier_governed_outputs` AS output
		JOIN `dossier_output_state_events` AS state
			ON state.`dossier_id` = output.`dossier_id`
			AND state.`output_id` = output.`id`
		JOIN `dossier_output_approvals` AS approval
			ON approval.`dossier_id` = output.`dossier_id`
			AND approval.`output_id` = output.`id`
		WHERE output.`dossier_id` = NEW.`id`
			AND state.`state` = 'current'
			AND state.`sequence` = (
				SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
				WHERE later.`dossier_id` = state.`dossier_id` AND later.`output_id` = state.`output_id`
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'output_approved requires a current governed output with reviewer approval');
END;
--> statement-breakpoint
CREATE TRIGGER `dossiers_status_transition_guard`
BEFORE UPDATE OF `status` ON `dossiers`
FOR EACH ROW
WHEN NEW.`status` IS NOT OLD.`status` AND NOT EXISTS (
	SELECT 1 FROM `dossier_status_transitions` AS transition
	WHERE transition.`dossier_id` = NEW.`id`
		AND transition.`revision_before` = OLD.`revision`
		AND transition.`revision_after` = NEW.`revision`
		AND transition.`previous_status` = OLD.`status`
		AND transition.`new_status` = NEW.`status`
		AND transition.`actor_ref` = NEW.`updated_by_actor_ref`
		AND (NEW.`status` <> 'archived'
			OR transition.`platform_admin_override` = NEW.`archive_admin_override`)
)
BEGIN
	SELECT RAISE(ABORT, 'dossier status changes require the exact pre-recorded governed transition');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_status_transitions_insert_guard`
BEFORE INSERT ON `dossier_status_transitions`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id`
			AND `revision` = NEW.`revision_before`
			AND `status` = NEW.`previous_status`
	) THEN RAISE(ABORT, 'status transition must bind the exact live previous revision and status') END;
	SELECT CASE WHEN NEW.`occurred_at` IS NULL OR unixepoch(NEW.`occurred_at`) IS NULL
		THEN RAISE(ABORT, 'status transition requires a valid occurrence timestamp') END;
	SELECT CASE WHEN NEW.`reason` IS NOT NULL
		AND (length(trim(NEW.`reason`)) < 1 OR length(NEW.`reason`) > 1000)
		THEN RAISE(ABORT, 'status transition reason is invalid') END;
	SELECT CASE WHEN NEW.`actor_role` <> 'platform_admin' AND NOT (
		(NEW.`previous_status` = 'draft' AND NEW.`new_status` = 'intake_review' AND NEW.`actor_role` IN ('owner','contributor'))
		OR (NEW.`previous_status` = 'draft' AND NEW.`new_status` = 'declined' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'draft' AND NEW.`new_status` = 'cancelled' AND NEW.`actor_role` = 'owner')
		OR (NEW.`previous_status` = 'intake_review' AND NEW.`new_status` = 'draft' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'intake_review' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'intake_review' AND NEW.`new_status` = 'awaiting_input' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'intake_review' AND NEW.`new_status` = 'declined' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'intake_review' AND NEW.`new_status` = 'cancelled' AND NEW.`actor_role` = 'owner')
		OR (NEW.`previous_status` = 'active' AND NEW.`new_status` = 'awaiting_input' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'active' AND NEW.`new_status` = 'internal_review' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'active' AND NEW.`new_status` = 'closed' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'active' AND NEW.`new_status` = 'cancelled' AND NEW.`actor_role` = 'owner')
		OR (NEW.`previous_status` = 'awaiting_input' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'awaiting_input' AND NEW.`new_status` = 'internal_review' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'awaiting_input' AND NEW.`new_status` = 'cancelled' AND NEW.`actor_role` = 'owner')
		OR (NEW.`previous_status` = 'internal_review' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'internal_review' AND NEW.`new_status` = 'awaiting_input' AND NEW.`actor_role` IN ('owner','contributor','reviewer'))
		OR (NEW.`previous_status` = 'internal_review' AND NEW.`new_status` = 'output_approved' AND NEW.`actor_role` = 'reviewer')
		OR (NEW.`previous_status` = 'internal_review' AND NEW.`new_status` = 'closed' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'output_approved' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'output_approved' AND NEW.`new_status` = 'closed' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'output_approved' AND NEW.`new_status` = 'cancelled' AND NEW.`actor_role` = 'owner')
		OR (NEW.`previous_status` = 'closed' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'closed' AND NEW.`new_status` = 'archived' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'declined' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'declined' AND NEW.`new_status` = 'archived' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'cancelled' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'cancelled' AND NEW.`new_status` = 'archived' AND NEW.`actor_role` IN ('owner','reviewer'))
		OR (NEW.`previous_status` = 'archived' AND NEW.`new_status` = 'active' AND NEW.`actor_role` IN ('owner','reviewer'))
	) THEN RAISE(ABORT, 'status transition edge or role is forbidden by the V1 registry') END;
	SELECT CASE WHEN NEW.`actor_role` = 'platform_admin' AND NOT (
		NEW.`previous_status` <> 'archived'
		AND NEW.`new_status` = 'archived'
		AND NEW.`platform_admin_override` = true
	) THEN RAISE(ABORT, 'platform admin is limited to the governed archive override') END;
	SELECT CASE WHEN NEW.`actor_role` <> 'platform_admin' AND NEW.`platform_admin_override` <> false
		THEN RAISE(ABORT, 'participant transitions cannot claim platform-admin override') END;
	SELECT CASE WHEN (
		NEW.`actor_role` = 'platform_admin'
		OR NOT (
			(NEW.`previous_status` = 'draft' AND NEW.`new_status` = 'intake_review')
			OR (NEW.`previous_status` = 'intake_review' AND NEW.`new_status` IN ('draft','active'))
			OR (NEW.`previous_status` = 'awaiting_input' AND NEW.`new_status` = 'active')
			OR (NEW.`previous_status` = 'internal_review' AND NEW.`new_status` IN ('active','output_approved'))
		)
	) AND length(trim(COALESCE(NEW.`reason`, ''))) = 0
	THEN RAISE(ABORT, 'status transition reason is required by the V1 registry') END;
	SELECT CASE WHEN NOT json_valid(NEW.`consequences`)
		OR (NEW.`new_status` = 'output_approved' AND json(NEW.`consequences`) <> json('["recompute_readiness","preserve_current_output"]'))
		OR (NEW.`new_status` <> 'output_approved' AND json(NEW.`consequences`) <> json('["recompute_readiness","mark_outputs_stale"]'))
	THEN RAISE(ABORT, 'status transition consequences must exactly match the V1 registry') END;
	SELECT CASE WHEN NEW.`actor_role` IN ('owner','contributor','reviewer','viewer') AND NOT EXISTS (
		SELECT 1 FROM `dossier_participants`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `user_id` = NEW.`actor_user_id`
			AND `actor_id` = NEW.`actor_ref`
			AND `role` = NEW.`actor_role`
			AND `status` = 'active'
	) THEN RAISE(ABORT, 'status transition actor must be an exact active participant authority') END;
	SELECT CASE WHEN NEW.`actor_role` = 'platform_admin' AND NOT EXISTS (
		SELECT 1 FROM `users` WHERE `id` = NEW.`actor_user_id` AND `actor_id` = NEW.`actor_ref`
	) THEN RAISE(ABORT, 'platform-admin archive override must bind a stable user actor') END;
	SELECT CASE WHEN NEW.`had_current_output` <> EXISTS (
		SELECT 1 FROM `dossier_governed_outputs` AS output
		JOIN `dossier_output_state_events` AS state
			ON state.`dossier_id` = output.`dossier_id` AND state.`output_id` = output.`id`
		WHERE output.`dossier_id` = NEW.`dossier_id`
			AND state.`state` = 'current'
			AND state.`sequence` = (
				SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
				WHERE later.`dossier_id` = state.`dossier_id` AND later.`output_id` = state.`output_id`
			)
	) THEN RAISE(ABORT, 'status transition current-output fact is not authoritative') END;
	SELECT CASE WHEN NEW.`had_reviewer_approval` <> EXISTS (
		SELECT 1 FROM `dossier_governed_outputs` AS output
		JOIN `dossier_output_state_events` AS state
			ON state.`dossier_id` = output.`dossier_id` AND state.`output_id` = output.`id`
		JOIN `dossier_output_approvals` AS approval
			ON approval.`dossier_id` = output.`dossier_id` AND approval.`output_id` = output.`id`
		WHERE output.`dossier_id` = NEW.`dossier_id`
			AND state.`state` = 'current'
			AND state.`sequence` = (
				SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
				WHERE later.`dossier_id` = state.`dossier_id` AND later.`output_id` = state.`output_id`
			)
	) THEN RAISE(ABORT, 'status transition reviewer-approval fact is not authoritative') END;
	SELECT CASE WHEN NEW.`new_status` = 'output_approved' AND NOT EXISTS (
		SELECT 1
		FROM `dossier_governed_outputs` AS output
		JOIN `dossier_output_state_events` AS state
			ON state.`dossier_id` = output.`dossier_id` AND state.`output_id` = output.`id`
		JOIN `dossier_output_approvals` AS approval
			ON approval.`dossier_id` = output.`dossier_id` AND approval.`output_id` = output.`id`
		WHERE output.`dossier_id` = NEW.`dossier_id`
			AND output.`id` = NEW.`approved_output_id`
			AND approval.`reviewer_user_id` = NEW.`actor_user_id`
			AND approval.`reviewer_actor_ref` = NEW.`actor_ref`
			AND state.`state` = 'current'
			AND state.`sequence` = (
				SELECT MAX(later.`sequence`) FROM `dossier_output_state_events` AS later
				WHERE later.`dossier_id` = state.`dossier_id` AND later.`output_id` = state.`output_id`
			)
	) THEN RAISE(ABORT, 'output approval transition must bind the exact current output and its reviewer') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_status_transitions_update_guard`
BEFORE UPDATE ON `dossier_status_transitions`
BEGIN
	SELECT RAISE(ABORT, 'dossier status transitions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_status_transitions_delete_guard`
BEFORE DELETE ON `dossier_status_transitions`
BEGIN
	SELECT RAISE(ABORT, 'dossier status transitions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_documents_insert_provisional_guard`
BEFORE INSERT ON `dossier_documents`
FOR EACH ROW
WHEN NEW.`is_provisional` <> true
BEGIN
	SELECT RAISE(ABORT, 'all logical documents must begin provisional');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_documents_reservation_guard`
BEFORE INSERT ON `dossier_documents`
FOR EACH ROW
WHEN (
	SELECT count(*) FROM `dossier_documents`
	WHERE `dossier_id` = NEW.`dossier_id`
) >= 100
BEGIN
	SELECT RAISE(ABORT, 'dossier document reservation quota exceeded');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_documents_identity_guard`
BEFORE UPDATE ON `dossier_documents`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`source_origin` IS NOT OLD.`source_origin`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'logical document identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_documents_finalize_guard`
BEFORE UPDATE OF `is_provisional` ON `dossier_documents`
FOR EACH ROW
WHEN (OLD.`is_provisional` = false AND NEW.`is_provisional` <> false)
	OR (OLD.`is_provisional` = true AND NEW.`is_provisional` = false AND NOT (
		(
			OLD.`source_origin` IN ('external_reference','import')
			AND EXISTS (
				SELECT 1 FROM `dossier_document_current_versions`
				WHERE `dossier_id` = OLD.`dossier_id` AND `document_id` = OLD.`id`
			)
		)
		OR
		(
			OLD.`source_origin` = 'internal_upload'
			AND EXISTS (
				SELECT 1
				FROM `dossier_document_current_versions` AS current_version
				JOIN `dossier_document_versions` AS version
					ON version.`dossier_id` = current_version.`dossier_id`
					AND version.`document_id` = current_version.`document_id`
					AND version.`id` = current_version.`document_version_id`
				JOIN `dossier_upload_intents` AS intent
					ON intent.`dossier_id` = version.`dossier_id`
					AND intent.`id` = version.`upload_intent_id`
				WHERE current_version.`dossier_id` = OLD.`dossier_id`
					AND current_version.`document_id` = OLD.`id`
					AND intent.`state` = 'committed'
			)
		)
	))
BEGIN
	SELECT RAISE(ABORT, 'provisional document finalization requires its contract-complete current version receipt and cannot reverse');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_documents_delete_guard`
BEFORE DELETE ON `dossier_documents`
FOR EACH ROW
WHEN OLD.`is_provisional` = false
	OR EXISTS (
		SELECT 1 FROM `dossier_document_versions`
		WHERE `dossier_id` = OLD.`dossier_id` AND `document_id` = OLD.`id`
	)
	OR EXISTS (
		SELECT 1 FROM `dossier_upload_intents`
		WHERE `dossier_id` = OLD.`dossier_id`
			AND `document_id` = OLD.`id`
			AND `state` <> 'deleted'
	)
BEGIN
	SELECT RAISE(ABORT, 'only a zero-version provisional document with completed cleanup can be deleted');
END;
--> statement-breakpoint
-- Internal uploads bind the exact server-measured bytes and current revision to
-- one pending idempotent intent. External/import versions remain possible.
CREATE TRIGGER `dossier_document_versions_lineage_guard`
BEFORE INSERT ON `dossier_document_versions`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NEW.`ordinal` = 1 AND EXISTS (
		SELECT 1 FROM `dossier_document_versions`
		WHERE `dossier_id` = NEW.`dossier_id` AND `document_id` = NEW.`document_id`
	) THEN RAISE(ABORT, 'first document version already exists') END;
	SELECT CASE WHEN NEW.`ordinal` > 1 AND NOT EXISTS (
		SELECT 1 FROM `dossier_document_versions`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `document_id` = NEW.`document_id`
			AND `id` = NEW.`predecessor_version_id`
			AND `ordinal` = NEW.`ordinal` - 1
	) THEN RAISE(ABORT, 'document version predecessor must be the prior ordinal') END;
	SELECT CASE WHEN (
		SELECT `source_origin` FROM `dossier_documents`
		WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`document_id`
	) = 'internal_upload' AND NEW.`upload_intent_id` IS NULL
	THEN RAISE(ABORT, 'internal document versions require an upload intent') END;
	SELECT CASE WHEN NEW.`upload_intent_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1
		FROM `dossier_upload_intents` AS intent
		JOIN `dossiers` AS dossier ON dossier.`id` = intent.`dossier_id`
		WHERE intent.`dossier_id` = NEW.`dossier_id`
			AND intent.`document_id` = NEW.`document_id`
			AND intent.`id` = NEW.`upload_intent_id`
			AND intent.`state` = 'pending'
			AND unixepoch(intent.`expires_at`) IS NOT NULL
			AND unixepoch(intent.`expires_at`) > unixepoch('now')
			AND dossier.`revision` = intent.`expected_dossier_revision`
			AND intent.`expected_media_type` = NEW.`media_type`
			AND intent.`expected_byte_length` = NEW.`byte_length`
			AND intent.`measured_media_type` = NEW.`media_type`
			AND intent.`measured_byte_length` = NEW.`byte_length`
			AND intent.`measured_content_sha256` = NEW.`content_sha256`
			AND intent.`committed_object_reference` = NEW.`binary_object_reference`
			AND (intent.`expected_content_sha256` IS NULL OR intent.`expected_content_sha256` = NEW.`content_sha256`)
	) THEN RAISE(ABORT, 'document version does not match its pending verified upload intent') END;
	SELECT CASE WHEN length(NEW.`binary_object_reference`) < 32
		OR instr(NEW.`binary_object_reference`, '://') > 0
		OR instr(NEW.`binary_object_reference`, '..') > 0
		OR instr(NEW.`binary_object_reference`, '\\') > 0
	THEN RAISE(ABORT, 'document object reference must be private and opaque') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_versions_quota_guard`
BEFORE INSERT ON `dossier_document_versions`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN (
		SELECT count(*) FROM `dossier_document_versions`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `document_id` = NEW.`document_id`
	) >= 50
	THEN RAISE(ABORT, 'document version quota exceeded') END;
	SELECT CASE WHEN (
		SELECT count(*) FROM `dossier_document_versions`
		WHERE `dossier_id` = NEW.`dossier_id`
	) >= 1000
	THEN RAISE(ABORT, 'dossier version quota exceeded') END;
	SELECT CASE WHEN
		COALESCE((
			SELECT sum(`byte_length`) FROM `dossier_document_versions`
			WHERE `dossier_id` = NEW.`dossier_id`
		), 0)
		+ NEW.`byte_length`
		+ COALESCE((
			SELECT sum(intent.`expected_byte_length`)
			FROM `dossier_upload_intents` AS intent
			WHERE intent.`dossier_id` = NEW.`dossier_id`
				AND intent.`state` = 'pending'
				AND (NEW.`upload_intent_id` IS NULL OR intent.`id` <> NEW.`upload_intent_id`)
				AND NOT EXISTS (
					SELECT 1 FROM `dossier_document_versions` AS reserved_version
					WHERE reserved_version.`dossier_id` = intent.`dossier_id`
						AND reserved_version.`upload_intent_id` = intent.`id`
				)
		), 0)
		> 1073741824
	THEN RAISE(ABORT, 'dossier storage reservation quota exceeded') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_versions_external_current_pointer`
AFTER INSERT ON `dossier_document_versions`
FOR EACH ROW
WHEN NEW.`ordinal` = 1 AND (
	SELECT `source_origin` FROM `dossier_documents`
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`document_id`
) IN ('external_reference','import')
BEGIN
	INSERT INTO `dossier_document_current_versions` (
		`dossier_id`, `document_id`, `document_version_id`, `updated_by_actor_ref`
	) VALUES (
		NEW.`dossier_id`, NEW.`document_id`, NEW.`id`, NEW.`created_by_actor_ref`
	);
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_versions_update_guard`
BEFORE UPDATE ON `dossier_document_versions`
BEGIN
	SELECT RAISE(ABORT, 'document versions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_versions_delete_guard`
BEFORE DELETE ON `dossier_document_versions`
BEGIN
	SELECT RAISE(ABORT, 'document versions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_current_versions_insert_guard`
BEFORE INSERT ON `dossier_document_current_versions`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `dossier_document_versions` AS candidate
	WHERE candidate.`dossier_id` = NEW.`dossier_id`
		AND candidate.`document_id` = NEW.`document_id`
		AND candidate.`id` = NEW.`document_version_id`
		AND candidate.`ordinal` = (
			SELECT MAX(latest.`ordinal`) FROM `dossier_document_versions` AS latest
			WHERE latest.`dossier_id` = NEW.`dossier_id` AND latest.`document_id` = NEW.`document_id`
		)
)
BEGIN
	SELECT RAISE(ABORT, 'current document version must be the latest immutable ordinal');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_current_versions_finalize_external_document`
AFTER INSERT ON `dossier_document_current_versions`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_documents`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`document_id`
		AND `is_provisional` = true
		AND `source_origin` IN ('external_reference','import')
)
BEGIN
	UPDATE `dossier_documents`
	SET `is_provisional` = false
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`document_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_current_versions_update_guard`
BEFORE UPDATE ON `dossier_document_current_versions`
FOR EACH ROW
WHEN NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`document_id` IS NOT OLD.`document_id`
	OR NOT EXISTS (
		SELECT 1 FROM `dossier_document_versions` AS candidate
		WHERE candidate.`dossier_id` = NEW.`dossier_id`
			AND candidate.`document_id` = NEW.`document_id`
			AND candidate.`id` = NEW.`document_version_id`
			AND candidate.`ordinal` = (
				SELECT MAX(latest.`ordinal`) FROM `dossier_document_versions` AS latest
				WHERE latest.`dossier_id` = NEW.`dossier_id` AND latest.`document_id` = NEW.`document_id`
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'current document version must be the latest immutable ordinal');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_document_current_versions_delete_guard`
BEFORE DELETE ON `dossier_document_current_versions`
BEGIN
	SELECT RAISE(ABORT, 'current document version pointer cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_object_insert_guard`
BEFORE INSERT ON `dossier_upload_intents`
FOR EACH ROW
WHEN length(NEW.`temporary_object_reference`) < 32
	OR instr(NEW.`temporary_object_reference`, '://') > 0
	OR instr(NEW.`temporary_object_reference`, '..') > 0
	OR instr(NEW.`temporary_object_reference`, '\\') > 0
	OR (NEW.`committed_object_reference` IS NOT NULL AND (
		length(NEW.`committed_object_reference`) < 32
		OR instr(NEW.`committed_object_reference`, '://') > 0
		OR instr(NEW.`committed_object_reference`, '..') > 0
		OR instr(NEW.`committed_object_reference`, '\\') > 0
	))
BEGIN
	SELECT RAISE(ABORT, 'upload object references must be private and opaque');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_insert_guard`
BEFORE INSERT ON `dossier_upload_intents`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NEW.`state` <> 'pending'
		OR NEW.`committed_object_reference` IS NOT NULL
		OR NEW.`measured_media_type` IS NOT NULL
		OR NEW.`measured_byte_length` IS NOT NULL
		OR NEW.`measured_content_sha256` IS NOT NULL
		OR NEW.`failure_code` IS NOT NULL
		OR NEW.`committed_at` IS NOT NULL
	THEN RAISE(ABORT, 'upload intent must begin as an unmeasured pending reservation') END;
	SELECT CASE WHEN unixepoch(NEW.`expires_at`) IS NULL
		OR unixepoch(NEW.`expires_at`) <= unixepoch('now')
	THEN RAISE(ABORT, 'upload intent reservation must expire in the future') END;
	SELECT CASE WHEN NEW.`actor_user_id` IS NULL OR NOT EXISTS (
		SELECT 1
		FROM `dossiers` AS dossier
		JOIN `dossier_participants` AS participant
			ON participant.`dossier_id` = dossier.`id`
		WHERE dossier.`id` = NEW.`dossier_id`
			AND dossier.`revision` = NEW.`expected_dossier_revision`
			AND participant.`user_id` = NEW.`actor_user_id`
			AND participant.`actor_id` = NEW.`actor_ref`
			AND participant.`role` IN ('owner','contributor')
			AND participant.`status` = 'active'
	) THEN RAISE(ABORT, 'upload intent must bind the live revision and active actor') END;
	SELECT CASE WHEN (
		SELECT count(*) FROM `dossier_upload_intents`
		WHERE `dossier_id` = NEW.`dossier_id` AND `state` = 'pending'
	) >= 20
	THEN RAISE(ABORT, 'pending upload reservation quota exceeded') END;
	SELECT CASE WHEN
		COALESCE((
			SELECT sum(`byte_length`) FROM `dossier_document_versions`
			WHERE `dossier_id` = NEW.`dossier_id`
		), 0)
		+ COALESCE((
			SELECT sum(intent.`expected_byte_length`)
			FROM `dossier_upload_intents` AS intent
			WHERE intent.`dossier_id` = NEW.`dossier_id`
				AND intent.`state` = 'pending'
				AND NOT EXISTS (
					SELECT 1 FROM `dossier_document_versions` AS reserved_version
					WHERE reserved_version.`dossier_id` = intent.`dossier_id`
						AND reserved_version.`upload_intent_id` = intent.`id`
				)
		), 0)
		+ NEW.`expected_byte_length`
		> 1073741824
	THEN RAISE(ABORT, 'dossier storage reservation quota exceeded') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_insert_state_guard`
BEFORE INSERT ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`state` <> 'pending' OR NEW.`committed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'upload intents must be inserted pending');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_object_update_guard`
BEFORE UPDATE OF `committed_object_reference` ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`committed_object_reference` IS NOT NULL AND (
	length(NEW.`committed_object_reference`) < 32
	OR instr(NEW.`committed_object_reference`, '://') > 0
	OR instr(NEW.`committed_object_reference`, '..') > 0
	OR instr(NEW.`committed_object_reference`, '\\') > 0
)
BEGIN
	SELECT RAISE(ABORT, 'upload object references must be private and opaque');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_identity_guard`
BEFORE UPDATE ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`document_id` IS NOT OLD.`document_id`
	OR NEW.`actor_ref` IS NOT OLD.`actor_ref`
	OR NEW.`idempotency_key_hash` IS NOT OLD.`idempotency_key_hash`
	OR NEW.`request_binding_digest` IS NOT OLD.`request_binding_digest`
	OR NEW.`expected_dossier_revision` IS NOT OLD.`expected_dossier_revision`
	OR NEW.`temporary_object_reference` IS NOT OLD.`temporary_object_reference`
	OR NEW.`actor_user_id` IS NOT OLD.`actor_user_id`
	OR NEW.`expected_media_type` IS NOT OLD.`expected_media_type`
	OR NEW.`expected_byte_length` IS NOT OLD.`expected_byte_length`
	OR NEW.`expected_content_sha256` IS NOT OLD.`expected_content_sha256`
	OR NEW.`expires_at` IS NOT OLD.`expires_at`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'upload intent identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_failure_guard`
BEFORE UPDATE ON `dossier_upload_intents`
FOR EACH ROW
WHEN (OLD.`failure_code` IS NOT NULL AND NEW.`failure_code` IS NOT OLD.`failure_code`)
	OR (OLD.`failure_code` IS NULL AND NEW.`failure_code` IS NOT NULL AND (
		OLD.`state` <> 'pending' OR NEW.`state` NOT IN ('pending','deleting')
	))
BEGIN
	SELECT RAISE(ABORT, 'upload failure receipt is immutable and only valid for a pending abort');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_measurement_guard`
BEFORE UPDATE ON `dossier_upload_intents`
FOR EACH ROW
WHEN (
	NEW.`committed_object_reference` IS NOT OLD.`committed_object_reference`
	OR NEW.`measured_media_type` IS NOT OLD.`measured_media_type`
	OR NEW.`measured_byte_length` IS NOT OLD.`measured_byte_length`
	OR NEW.`measured_content_sha256` IS NOT OLD.`measured_content_sha256`
) AND NOT (
	OLD.`state` = 'pending'
	AND NEW.`state` = 'pending'
	AND OLD.`committed_object_reference` IS NULL
	AND OLD.`measured_media_type` IS NULL
	AND OLD.`measured_byte_length` IS NULL
	AND OLD.`measured_content_sha256` IS NULL
	AND NEW.`committed_object_reference` IS NOT NULL
	AND NEW.`measured_media_type` IS NOT NULL
	AND NEW.`measured_byte_length` IS NOT NULL
	AND NEW.`measured_content_sha256` IS NOT NULL
)
BEGIN
	SELECT RAISE(ABORT, 'measured upload receipt can be written exactly once while pending');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_state_guard`
BEFORE UPDATE OF `state` ON `dossier_upload_intents`
FOR EACH ROW
WHEN NOT (
	(OLD.`state` = 'pending' AND NEW.`state` IN ('pending','committed','deleting','expired'))
	OR (OLD.`state` = 'expired' AND NEW.`state` IN ('expired','deleting'))
	OR (OLD.`state` = 'deleting' AND NEW.`state` IN ('deleting','deleted'))
	OR (OLD.`state` = 'deleted' AND NEW.`state` = 'deleted')
	OR (OLD.`state` = 'committed' AND NEW.`state` = 'committed')
)
BEGIN
	SELECT RAISE(ABORT, 'invalid upload intent state transition');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_terminal_guard`
BEFORE UPDATE ON `dossier_upload_intents`
FOR EACH ROW
WHEN OLD.`state` IN ('committed','deleted')
BEGIN
	SELECT RAISE(ABORT, 'terminal upload intent is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_expire_guard`
BEFORE UPDATE OF `state` ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`state` = 'expired' AND OLD.`state` <> 'expired'
BEGIN
	SELECT CASE WHEN OLD.`state` <> 'pending'
		OR unixepoch(OLD.`expires_at`) IS NULL
		OR unixepoch(OLD.`expires_at`) > unixepoch('now')
		OR EXISTS (
			SELECT 1 FROM `dossier_document_versions`
			WHERE `upload_intent_id` = OLD.`id`
				OR `binary_object_reference` = OLD.`temporary_object_reference`
				OR (OLD.`committed_object_reference` IS NOT NULL AND `binary_object_reference` = OLD.`committed_object_reference`)
		)
	THEN RAISE(ABORT, 'only an expired unreferenced pending upload can expire') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_commit_guard`
BEFORE UPDATE OF `state` ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`state` = 'committed' AND OLD.`state` <> 'committed'
BEGIN
	SELECT CASE WHEN unixepoch(NEW.`expires_at`) IS NULL
		OR unixepoch(NEW.`expires_at`) <= unixepoch('now')
	THEN RAISE(ABORT, 'expired upload intent cannot commit') END;
	SELECT CASE WHEN OLD.`state` <> 'pending'
		OR NEW.`committed_object_reference` IS NULL
		OR NEW.`measured_media_type` IS NULL
		OR NEW.`measured_byte_length` IS NULL
		OR NEW.`measured_content_sha256` IS NULL
		OR NEW.`committed_at` IS NULL
		OR OLD.`failure_code` IS NOT NULL
		OR NEW.`failure_code` IS NOT NULL
		OR NEW.`measured_media_type` <> NEW.`expected_media_type`
		OR NEW.`measured_byte_length` <> NEW.`expected_byte_length`
		OR (NEW.`expected_content_sha256` IS NOT NULL AND NEW.`measured_content_sha256` <> NEW.`expected_content_sha256`)
	THEN RAISE(ABORT, 'only a measured pending upload intent can commit') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `dossier_document_versions` AS version
		JOIN `dossier_document_current_versions` AS current_version
			ON current_version.`dossier_id` = version.`dossier_id`
			AND current_version.`document_id` = version.`document_id`
			AND current_version.`document_version_id` = version.`id`
		JOIN `dossiers` AS dossier ON dossier.`id` = version.`dossier_id`
		JOIN `dossier_revision_receipts` AS receipt
			ON receipt.`dossier_id` = dossier.`id`
			AND receipt.`resulting_revision` = dossier.`revision`
		WHERE version.`dossier_id` = NEW.`dossier_id`
			AND version.`document_id` = NEW.`document_id`
			AND version.`upload_intent_id` = NEW.`id`
			AND version.`binary_object_reference` = NEW.`committed_object_reference`
			AND version.`media_type` = NEW.`measured_media_type`
			AND version.`byte_length` = NEW.`measured_byte_length`
			AND version.`content_sha256` = NEW.`measured_content_sha256`
			AND dossier.`revision` = NEW.`expected_dossier_revision` + 1
	) THEN RAISE(ABORT, 'committed upload intent lacks its current version and dossier revision receipt') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_finalize_document`
AFTER UPDATE OF `state` ON `dossier_upload_intents`
FOR EACH ROW
WHEN OLD.`state` = 'pending' AND NEW.`state` = 'committed'
	AND EXISTS (
		SELECT 1 FROM `dossier_documents`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `id` = NEW.`document_id`
			AND `is_provisional` = true
			AND `source_origin` = 'internal_upload'
	)
BEGIN
	UPDATE `dossier_documents`
	SET `is_provisional` = false
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`document_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_cleanup_guard`
BEFORE UPDATE OF `state` ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`state` = 'deleting' AND OLD.`state` <> 'deleting'
BEGIN
	SELECT CASE WHEN OLD.`state` NOT IN ('pending','expired')
		OR (OLD.`state` = 'pending'
			AND (unixepoch(OLD.`expires_at`) IS NULL OR unixepoch(OLD.`expires_at`) > unixepoch('now'))
			AND NEW.`failure_code` IS NULL)
		OR EXISTS (
			SELECT 1 FROM `dossier_document_versions`
			WHERE `upload_intent_id` = OLD.`id`
				OR `binary_object_reference` = OLD.`temporary_object_reference`
				OR (OLD.`committed_object_reference` IS NOT NULL AND `binary_object_reference` = OLD.`committed_object_reference`)
		)
	THEN RAISE(ABORT, 'only an expired unreferenced upload can enter cleanup') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_finish_cleanup_guard`
BEFORE UPDATE OF `state` ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`state` = 'deleted' AND OLD.`state` <> 'deleted'
BEGIN
	SELECT CASE WHEN OLD.`state` <> 'deleting'
		OR EXISTS (
			SELECT 1 FROM `dossier_document_versions`
			WHERE `upload_intent_id` = OLD.`id`
				OR `binary_object_reference` = OLD.`temporary_object_reference`
				OR (OLD.`committed_object_reference` IS NOT NULL AND `binary_object_reference` = OLD.`committed_object_reference`)
		)
	THEN RAISE(ABORT, 'cleanup completion requires a deleting unreferenced upload') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_upload_intents_delete_guard`
BEFORE DELETE ON `dossier_upload_intents`
FOR EACH ROW
WHEN OLD.`state` <> 'deleted'
	OR EXISTS (
		SELECT 1 FROM `dossier_document_versions`
		WHERE `upload_intent_id` = OLD.`id`
			OR `binary_object_reference` = OLD.`temporary_object_reference`
			OR (OLD.`committed_object_reference` IS NOT NULL AND `binary_object_reference` = OLD.`committed_object_reference`)
	)
BEGIN
	SELECT RAISE(ABORT, 'only completed unreferenced upload cleanup metadata can be deleted');
END;
--> statement-breakpoint
-- The pilot extractor is deliberately deterministic UTF-8 TXT/Markdown only.
-- PDF/DOCX are retained as attachments with honest not_extractable state.
CREATE TRIGGER `dossier_extraction_jobs_insert_media_guard`
BEFORE INSERT ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_document_versions`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `document_id` = NEW.`document_id`
		AND `id` = NEW.`document_version_id`
		AND `media_type` IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
)
AND NEW.`status` <> 'not_extractable'
BEGIN
	SELECT RAISE(ABORT, 'PDF and DOCX extraction is disabled for the pilot');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_insert_state_guard`
BEFORE INSERT ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN NOT (
	(
		NEW.`status` = 'queued'
		AND NEW.`lease_owner` IS NULL
		AND NEW.`lease_expires_at` IS NULL
		AND NEW.`error_code` IS NULL
		AND NEW.`error_detail_code` IS NULL
		AND NEW.`started_at` IS NULL
		AND NEW.`completed_at` IS NULL
	)
	OR
	(
		NEW.`status` = 'not_extractable'
		AND NEW.`attempt` = 1
		AND NEW.`lease_owner` IS NULL
		AND NEW.`lease_expires_at` IS NULL
		AND NEW.`error_code` = 'unsupported_type'
		AND NEW.`error_detail_code` IS NOT NULL
		AND NEW.`started_at` IS NULL
		AND NEW.`completed_at` IS NULL
	)
)
BEGIN
	SELECT RAISE(ABORT, 'extraction job must begin queued or honestly not extractable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_update_media_guard`
BEFORE UPDATE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_document_versions`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `document_id` = NEW.`document_id`
		AND `id` = NEW.`document_version_id`
		AND `media_type` IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
)
AND NEW.`status` <> 'not_extractable'
BEGIN
	SELECT RAISE(ABORT, 'PDF and DOCX extraction is disabled for the pilot');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_identity_guard`
BEFORE UPDATE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`document_id` IS NOT OLD.`document_id`
	OR NEW.`document_version_id` IS NOT OLD.`document_version_id`
	OR NEW.`extractor_version` IS NOT OLD.`extractor_version`
	OR NEW.`attempt` IS NOT OLD.`attempt`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'extraction job identity and provenance are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_state_guard`
BEFORE UPDATE OF `status` ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN NOT (
	(OLD.`status` = 'queued' AND NEW.`status` IN ('queued','processing','failed'))
	OR (OLD.`status` = 'processing' AND NEW.`status` IN ('queued','processing','ready','failed'))
	OR (OLD.`status` = 'ready' AND NEW.`status` = 'ready')
	OR (OLD.`status` = 'failed' AND NEW.`status` = 'failed')
	OR (OLD.`status` = 'not_extractable' AND NEW.`status` = 'not_extractable')
)
BEGIN
	SELECT RAISE(ABORT, 'invalid extraction job state transition');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_state_shape_guard`
BEFORE UPDATE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN NOT (
	(
		NEW.`status` = 'queued'
		AND NEW.`lease_owner` IS NULL
		AND NEW.`lease_expires_at` IS NULL
		AND NEW.`error_code` IS NULL
		AND NEW.`error_detail_code` IS NULL
		AND NEW.`started_at` IS NULL
		AND NEW.`completed_at` IS NULL
	)
	OR
	(
		NEW.`status` = 'processing'
		AND NEW.`lease_owner` IS NOT NULL
		AND NEW.`lease_expires_at` IS NOT NULL
		AND NEW.`error_code` IS NULL
		AND NEW.`error_detail_code` IS NULL
		AND NEW.`started_at` IS NOT NULL
		AND NEW.`completed_at` IS NULL
	)
	OR
	(
		NEW.`status` = 'ready'
		AND NEW.`lease_owner` IS NULL
		AND NEW.`lease_expires_at` IS NULL
		AND NEW.`error_code` IS NULL
		AND NEW.`error_detail_code` IS NULL
		AND NEW.`started_at` IS NOT NULL
		AND NEW.`completed_at` IS NOT NULL
	)
	OR
	(
		NEW.`status` = 'failed'
		AND NEW.`lease_owner` IS NULL
		AND NEW.`lease_expires_at` IS NULL
		AND NEW.`error_code` IS NOT NULL
		AND NEW.`completed_at` IS NOT NULL
	)
	OR
	(
		NEW.`status` = 'not_extractable'
		AND NEW.`lease_owner` IS NULL
		AND NEW.`lease_expires_at` IS NULL
		AND NEW.`error_code` = 'unsupported_type'
		AND NEW.`error_detail_code` IS NOT NULL
		AND NEW.`started_at` IS NULL
		AND NEW.`completed_at` IS NULL
	)
)
BEGIN
	SELECT RAISE(ABORT, 'extraction job state receipt is incomplete');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_requeue_guard`
BEFORE UPDATE OF `status` ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN OLD.`status` = 'processing' AND NEW.`status` = 'queued' AND (
	OLD.`lease_expires_at` IS NULL
	OR unixepoch(OLD.`lease_expires_at`) IS NULL
	OR unixepoch(OLD.`lease_expires_at`) > unixepoch('now')
	OR NEW.`lease_owner` IS NOT NULL
	OR NEW.`lease_expires_at` IS NOT NULL
	OR NEW.`started_at` IS NOT NULL
	OR NEW.`completed_at` IS NOT NULL
	OR NEW.`error_code` IS NOT NULL
	OR NEW.`error_detail_code` IS NOT NULL
	OR EXISTS (
		SELECT 1 FROM `dossier_extraction_results`
		WHERE `dossier_id` = OLD.`dossier_id` AND `extraction_job_id` = OLD.`id`
	)
)
BEGIN
	SELECT RAISE(ABORT, 'only an expired result-free extraction lease can requeue');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_result_guard`
BEFORE UPDATE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_extraction_results`
	WHERE `dossier_id` = OLD.`dossier_id` AND `extraction_job_id` = OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'extraction job with an immutable result cannot change');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_jobs_delete_guard`
BEFORE DELETE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_extraction_results`
	WHERE `dossier_id` = OLD.`dossier_id` AND `extraction_job_id` = OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'extraction job with an immutable result cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_results_insert_guard`
BEFORE INSERT ON `dossier_extraction_results`
FOR EACH ROW
WHEN length(NEW.`extracted_text_object_reference`) < 32
	OR instr(NEW.`extracted_text_object_reference`, '://') > 0
	OR instr(NEW.`extracted_text_object_reference`, '..') > 0
	OR instr(NEW.`extracted_text_object_reference`, '\\') > 0
	OR NOT EXISTS (
	SELECT 1
	FROM `dossier_document_versions` AS version
	JOIN `dossier_extraction_jobs` AS job
		ON job.`dossier_id` = version.`dossier_id`
		AND job.`document_id` = version.`document_id`
		AND job.`document_version_id` = version.`id`
	WHERE version.`dossier_id` = NEW.`dossier_id`
		AND version.`document_id` = NEW.`document_id`
		AND version.`id` = NEW.`document_version_id`
		AND version.`media_type` IN ('text/plain','text/markdown')
		AND job.`id` = NEW.`extraction_job_id`
		AND job.`status` = 'ready'
		AND job.`extractor_version` = NEW.`extractor_version`
)
BEGIN
	SELECT RAISE(ABORT, 'extraction result requires a ready deterministic text job');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_results_update_guard`
BEFORE UPDATE ON `dossier_extraction_results`
BEGIN
	SELECT RAISE(ABORT, 'extraction results are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_results_delete_guard`
BEFORE DELETE ON `dossier_extraction_results`
BEGIN
	SELECT RAISE(ABORT, 'extraction results are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_page_maps_update_guard`
BEFORE UPDATE ON `dossier_extraction_page_maps`
BEGIN
	SELECT RAISE(ABORT, 'extraction page maps are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_page_maps_insert_guard`
BEFORE INSERT ON `dossier_extraction_page_maps`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `dossier_extraction_results`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `document_id` = NEW.`document_id`
		AND `document_version_id` = NEW.`document_version_id`
		AND `id` = NEW.`extraction_result_id`
)
BEGIN
	SELECT RAISE(ABORT, 'page map must bind the exact extraction result version');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_extraction_page_maps_delete_guard`
BEFORE DELETE ON `dossier_extraction_page_maps`
BEGIN
	SELECT RAISE(ABORT, 'extraction page maps are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_source_anchors_insert_review_guard`
BEFORE INSERT ON `dossier_source_anchors`
FOR EACH ROW
WHEN NEW.`review_state` <> 'pending'
	OR NEW.`reviewer_user_id` IS NOT NULL
	OR NEW.`reviewer_actor_ref` IS NOT NULL
	OR NEW.`reviewed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'source anchors must enter review as pending');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_source_anchors_update_guard`
BEFORE UPDATE ON `dossier_source_anchors`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NEW.`id` IS NOT OLD.`id`
		OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
		OR NEW.`document_id` IS NOT OLD.`document_id`
		OR NEW.`document_version_id` IS NOT OLD.`document_version_id`
		OR NEW.`page_number` IS NOT OLD.`page_number`
		OR NEW.`section` IS NOT OLD.`section`
		OR NEW.`heading` IS NOT OLD.`heading`
		OR NEW.`paragraph` IS NOT OLD.`paragraph`
		OR NEW.`character_start` IS NOT OLD.`character_start`
		OR NEW.`character_end` IS NOT OLD.`character_end`
		OR NEW.`excerpt` IS NOT OLD.`excerpt`
		OR NEW.`anchor_checksum` IS NOT OLD.`anchor_checksum`
		OR NEW.`extraction_version` IS NOT OLD.`extraction_version`
		OR NEW.`creator` IS NOT OLD.`creator`
		OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
		OR NEW.`created_at` IS NOT OLD.`created_at`
	THEN RAISE(ABORT, 'source anchor identity and provenance are immutable') END;
	SELECT CASE WHEN OLD.`review_state` <> 'pending'
		OR NEW.`review_state` NOT IN ('accepted','rejected')
		OR NEW.`reviewer_user_id` IS NULL
		OR NEW.`reviewer_actor_ref` IS NULL
		OR NEW.`reviewed_at` IS NULL
		OR NOT EXISTS (
			SELECT 1 FROM `dossier_participants`
			WHERE `dossier_id` = NEW.`dossier_id`
				AND `user_id` = NEW.`reviewer_user_id`
				AND `actor_id` = NEW.`reviewer_actor_ref`
				AND `status` = 'active'
				AND `role` IN ('owner','contributor','reviewer')
		)
	THEN RAISE(ABORT, 'source anchor review requires an active bound participant') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_source_anchors_delete_guard`
BEFORE DELETE ON `dossier_source_anchors`
BEGIN
	SELECT RAISE(ABORT, 'source anchors are governed provenance and cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_professional_assertions_insert_review_guard`
BEFORE INSERT ON `dossier_professional_assertions`
FOR EACH ROW
WHEN NEW.`status` <> 'needs_review'
	OR NEW.`reviewed_by_user_id` IS NOT NULL
	OR NEW.`reviewed_by_actor_ref` IS NOT NULL
	OR NEW.`reviewed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'professional assertions must enter review as needs_review');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_professional_assertions_identity_guard`
BEFORE UPDATE ON `dossier_professional_assertions`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`originating_proposal_id` IS NOT OLD.`originating_proposal_id`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'professional assertion identity and origin are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_professional_assertions_update_guard`
BEFORE UPDATE ON `dossier_professional_assertions`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN OLD.`status` <> 'needs_review'
		AND (NEW.`status` <> 'superseded' OR OLD.`status` <> 'accepted')
	THEN RAISE(ABORT, 'reviewed professional assertions are immutable except supersession') END;
	SELECT CASE WHEN OLD.`status` <> 'needs_review' AND (
		NEW.`id` IS NOT OLD.`id`
		OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
		OR NEW.`assertion_type` IS NOT OLD.`assertion_type`
		OR NEW.`statement` IS NOT OLD.`statement`
		OR NEW.`originating_proposal_id` IS NOT OLD.`originating_proposal_id`
		OR NEW.`reviewed_by_user_id` IS NOT OLD.`reviewed_by_user_id`
		OR NEW.`reviewed_by_actor_ref` IS NOT OLD.`reviewed_by_actor_ref`
		OR NEW.`reviewed_at` IS NOT OLD.`reviewed_at`
		OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
		OR NEW.`created_at` IS NOT OLD.`created_at`
	) THEN RAISE(ABORT, 'reviewed professional assertion provenance is immutable') END;
	SELECT CASE WHEN NEW.`status` IN ('accepted','rejected') AND OLD.`status` = 'needs_review' AND (
		NEW.`reviewed_by_user_id` IS NULL
		OR NEW.`reviewed_by_actor_ref` IS NULL
		OR NEW.`reviewed_at` IS NULL
		OR NOT EXISTS (
			SELECT 1 FROM `dossier_participants`
			WHERE `dossier_id` = NEW.`dossier_id`
				AND `user_id` = NEW.`reviewed_by_user_id`
				AND `actor_id` = NEW.`reviewed_by_actor_ref`
				AND `status` = 'active'
				AND `role` IN ('owner','contributor','reviewer')
		)
	) THEN RAISE(ABORT, 'assertion review requires an active bound participant') END;
	SELECT CASE WHEN NEW.`status` = 'accepted' AND OLD.`status` = 'needs_review' AND (
		NOT EXISTS (
			SELECT 1 FROM `dossier_assertion_sources`
			WHERE `dossier_id` = NEW.`dossier_id` AND `assertion_id` = NEW.`id`
		)
		OR EXISTS (
			SELECT 1 FROM `dossier_assertion_sources` AS source
			JOIN `dossier_source_anchors` AS anchor
				ON anchor.`dossier_id` = source.`dossier_id`
				AND anchor.`id` = source.`source_anchor_id`
			WHERE source.`dossier_id` = NEW.`dossier_id`
				AND source.`assertion_id` = NEW.`id`
				AND anchor.`review_state` <> 'accepted'
		)
	) THEN RAISE(ABORT, 'accepted assertion requires only accepted source anchors') END;
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_professional_assertions_delete_guard`
BEFORE DELETE ON `dossier_professional_assertions`
BEGIN
	SELECT RAISE(ABORT, 'professional assertions are governed provenance and cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_assertion_sources_insert_guard`
BEFORE INSERT ON `dossier_assertion_sources`
FOR EACH ROW
WHEN (SELECT `status` FROM `dossier_professional_assertions`
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`assertion_id`) <> 'needs_review'
BEGIN
	SELECT RAISE(ABORT, 'assertion sources can only be assembled before review');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_assertion_sources_update_guard`
BEFORE UPDATE ON `dossier_assertion_sources`
BEGIN
	SELECT RAISE(ABORT, 'assertion source rows are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_assertion_sources_delete_guard`
BEFORE DELETE ON `dossier_assertion_sources`
FOR EACH ROW
WHEN (SELECT `status` FROM `dossier_professional_assertions`
	WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`assertion_id`) <> 'needs_review'
BEGIN
	SELECT RAISE(ABORT, 'reviewed assertion provenance cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_evidence_links_insert_guard`
BEFORE INSERT ON `dossier_evidence_links`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `dossier_source_anchors`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`source_anchor_id`
		AND `review_state` = 'accepted'
)
	OR (NEW.`assertion_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `dossier_professional_assertions`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `id` = NEW.`assertion_id`
			AND `status` = 'accepted'
	))
	OR (NEW.`target_type` = 'professional_assertion' AND (
		NEW.`assertion_id` IS NULL OR NEW.`target_id` <> NEW.`assertion_id`
	))
	OR NOT EXISTS (
		SELECT 1 FROM `dossier_participants`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `user_id` = NEW.`reviewed_by_user_id`
			AND `actor_id` = NEW.`reviewed_by_actor_ref`
			AND `status` = 'active'
			AND `role` IN ('owner','contributor','reviewer')
	)
BEGIN
	SELECT RAISE(ABORT, 'evidence link requires accepted provenance and a bound reviewer');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_evidence_links_update_guard`
BEFORE UPDATE ON `dossier_evidence_links`
BEGIN
	SELECT RAISE(ABORT, 'reviewed evidence links are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_evidence_links_delete_guard`
BEFORE DELETE ON `dossier_evidence_links`
BEGIN
	SELECT RAISE(ABORT, 'reviewed evidence links cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_information_requests_owner_insert_guard`
BEFORE INSERT ON `dossier_information_requests`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `dossier_participants`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `user_id` = NEW.`owner_user_id`
		AND `actor_id` = NEW.`owner_actor_ref`
		AND `status` = 'active'
)
BEGIN
	SELECT RAISE(ABORT, 'information request owner must be an active bound participant');
END;
--> statement-breakpoint
CREATE TRIGGER `dossier_information_requests_document_insert_guard`
BEFORE INSERT ON `dossier_information_requests`
FOR EACH ROW
WHEN NEW.`satisfying_document_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `dossier_documents`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`satisfying_document_id`
		AND `is_provisional` = false
)
BEGIN
	SELECT RAISE(ABORT, 'information request satisfaction requires a finalized document');
END;
