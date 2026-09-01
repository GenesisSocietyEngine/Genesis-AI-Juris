CREATE TRIGGER `dossier_information_requests_identity_guard`
BEFORE UPDATE ON `dossier_information_requests`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'information request identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_information_requests_owner_update_guard`
BEFORE UPDATE ON `dossier_information_requests`
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
END;--> statement-breakpoint
CREATE TRIGGER `dossier_information_requests_document_update_guard`
BEFORE UPDATE ON `dossier_information_requests`
FOR EACH ROW
WHEN NEW.`satisfying_document_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `dossier_documents`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`satisfying_document_id`
		AND `is_provisional` = false
)
BEGIN
	SELECT RAISE(ABORT, 'information request satisfaction requires a finalized document');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_information_requests_delete_guard`
BEFORE DELETE ON `dossier_information_requests`
BEGIN
	SELECT RAISE(ABORT, 'information requests must be waived or cancelled, not deleted');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_deadline_sources_insert_guard`
BEFORE INSERT ON `dossier_deadline_sources`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `dossier_source_anchors`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`source_anchor_id`
		AND `review_state` = 'accepted'
)
BEGIN
	SELECT RAISE(ABORT, 'deadline provenance requires an accepted source anchor');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_deadline_references_identity_guard`
BEFORE UPDATE ON `dossier_deadline_references`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'deadline reference identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_deadline_sources_update_guard`
BEFORE UPDATE ON `dossier_deadline_sources`
BEGIN
	SELECT RAISE(ABORT, 'deadline source rows are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_deadline_sources_delete_guard`
BEFORE DELETE ON `dossier_deadline_sources`
BEGIN
	SELECT RAISE(ABORT, 'deadline source rows are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_deadline_references_delete_guard`
BEFORE DELETE ON `dossier_deadline_references`
BEGIN
	SELECT RAISE(ABORT, 'deadline references must be completed, waived, or cancelled, not deleted');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_insert_guard`
BEFORE INSERT ON `dossier_ai_proposal_jobs`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NEW.`status` <> 'queued'
		OR NEW.`attempt` <> 1
		OR NEW.`lease_owner` IS NOT NULL
		OR NEW.`lease_expires_at` IS NOT NULL
		OR NEW.`provider_receipt_digest` IS NOT NULL
		OR NEW.`error_code` IS NOT NULL
		OR NEW.`error_detail_code` IS NOT NULL
		OR NEW.`started_at` IS NOT NULL
		OR NEW.`completed_at` IS NOT NULL
	THEN RAISE(ABORT, 'AI proposal job must begin as an unleased queued request') END;
	SELECT CASE WHEN unixepoch(NEW.`created_at`) IS NULL
		OR unixepoch(NEW.`updated_at`) IS NULL
		OR unixepoch(NEW.`updated_at`) < unixepoch(NEW.`created_at`)
	THEN RAISE(ABORT, 'AI proposal job timestamps are invalid') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`expected_dossier_revision`
	) THEN RAISE(ABORT, 'AI proposal job must bind the current dossier revision') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_participants`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `user_id` = NEW.`requested_by_user_id`
			AND `actor_id` = NEW.`requested_by_actor_ref`
			AND `status` = 'active'
			AND `role` IN ('owner','contributor','reviewer')
	) THEN RAISE(ABORT, 'AI proposal job requester must be an exact active professional participant') END;
	SELECT CASE WHEN (
		SELECT COUNT(*) FROM `dossier_ai_proposal_jobs`
		WHERE `dossier_id` = NEW.`dossier_id` AND `status` IN ('queued','processing')
	) >= 10 THEN RAISE(ABORT, 'AI proposal job active quota exceeded') END;
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_identity_guard`
BEFORE UPDATE ON `dossier_ai_proposal_jobs`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`expected_dossier_revision` IS NOT OLD.`expected_dossier_revision`
	OR NEW.`requested_by_user_id` IS NOT OLD.`requested_by_user_id`
	OR NEW.`requested_by_actor_ref` IS NOT OLD.`requested_by_actor_ref`
	OR NEW.`idempotency_key_hash` IS NOT OLD.`idempotency_key_hash`
	OR NEW.`request_digest` IS NOT OLD.`request_digest`
	OR NEW.`model_provider` IS NOT OLD.`model_provider`
	OR NEW.`model_name` IS NOT OLD.`model_name`
	OR NEW.`model_configuration_digest` IS NOT OLD.`model_configuration_digest`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'AI proposal job request identity and model provenance are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_state_guard`
BEFORE UPDATE ON `dossier_ai_proposal_jobs`
FOR EACH ROW
WHEN NOT (
	(OLD.`status` = 'queued' AND NEW.`status` = 'processing' AND NEW.`attempt` = OLD.`attempt`)
	OR (OLD.`status` = 'queued' AND NEW.`status` = 'failed' AND NEW.`attempt` = OLD.`attempt`)
	OR (OLD.`status` = 'processing' AND NEW.`status` = 'processing'
		AND NEW.`attempt` = OLD.`attempt`
		AND NEW.`lease_owner` IS OLD.`lease_owner`
		AND NEW.`started_at` IS OLD.`started_at`)
	OR (OLD.`status` = 'processing' AND NEW.`status` IN ('ready','failed')
		AND NEW.`attempt` = OLD.`attempt`)
	OR (OLD.`status` = 'processing' AND NEW.`status` = 'queued'
		AND NEW.`attempt` = OLD.`attempt` + 1
		AND OLD.`attempt` < 5
		AND unixepoch(OLD.`lease_expires_at`) IS NOT NULL
		AND unixepoch(OLD.`lease_expires_at`) <= unixepoch('now'))
	OR (OLD.`status` = 'failed' AND NEW.`status` = 'queued'
		AND NEW.`attempt` = OLD.`attempt` + 1 AND OLD.`attempt` < 5)
)
BEGIN
	SELECT RAISE(ABORT, 'invalid AI proposal job state transition or retry');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_state_shape_guard`
BEFORE UPDATE ON `dossier_ai_proposal_jobs`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN unixepoch(NEW.`updated_at`) IS NULL
		OR unixepoch(NEW.`updated_at`) < unixepoch(OLD.`updated_at`)
		OR (NEW.`started_at` IS NOT NULL AND unixepoch(NEW.`started_at`) IS NULL)
		OR (NEW.`completed_at` IS NOT NULL AND unixepoch(NEW.`completed_at`) IS NULL)
		OR (NEW.`completed_at` IS NOT NULL
			AND unixepoch(NEW.`completed_at`) < unixepoch(COALESCE(NEW.`started_at`, NEW.`created_at`)))
	THEN RAISE(ABORT, 'AI proposal job timestamps are invalid') END;
	SELECT CASE WHEN NOT (
		(NEW.`status` = 'queued'
			AND NEW.`lease_owner` IS NULL AND NEW.`lease_expires_at` IS NULL
			AND NEW.`provider_receipt_digest` IS NULL
			AND NEW.`error_code` IS NULL AND NEW.`error_detail_code` IS NULL
			AND NEW.`started_at` IS NULL AND NEW.`completed_at` IS NULL)
		OR (NEW.`status` = 'processing'
			AND NEW.`lease_owner` IS NOT NULL AND NEW.`lease_expires_at` IS NOT NULL
			AND unixepoch(NEW.`lease_expires_at`) > unixepoch('now')
			AND unixepoch(NEW.`lease_expires_at`) <= unixepoch('now', '+15 minutes')
			AND NEW.`provider_receipt_digest` IS NULL
			AND NEW.`error_code` IS NULL AND NEW.`error_detail_code` IS NULL
			AND NEW.`started_at` IS NOT NULL AND NEW.`completed_at` IS NULL)
		OR (NEW.`status` = 'ready'
			AND NEW.`lease_owner` IS NULL AND NEW.`lease_expires_at` IS NULL
			AND NEW.`provider_receipt_digest` IS NOT NULL
			AND NEW.`error_code` IS NULL AND NEW.`error_detail_code` IS NULL
			AND NEW.`started_at` IS NOT NULL AND NEW.`completed_at` IS NOT NULL)
		OR (NEW.`status` = 'failed'
			AND NEW.`lease_owner` IS NULL AND NEW.`lease_expires_at` IS NULL
			AND NEW.`error_code` IS NOT NULL AND NEW.`error_detail_code` IS NOT NULL
			AND NEW.`completed_at` IS NOT NULL)
	) THEN RAISE(ABORT, 'AI proposal job state receipt is incomplete') END;
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_job_sources_insert_guard`
BEFORE INSERT ON `dossier_ai_proposal_job_sources`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `dossier_ai_proposal_jobs` AS job
		JOIN `dossiers` AS dossier ON dossier.`id` = job.`dossier_id`
		WHERE job.`dossier_id` = NEW.`dossier_id`
			AND job.`id` = NEW.`job_id`
			AND job.`status` = 'processing'
			AND job.`attempt` = NEW.`job_attempt`
			AND job.`lease_owner` = NEW.`lease_owner`
			AND unixepoch(job.`lease_expires_at`) > unixepoch('now')
			AND (
				dossier.`revision` = job.`expected_dossier_revision`
				OR (
					dossier.`revision` = job.`expected_dossier_revision` + 1
					AND NOT EXISTS (
						SELECT 1 FROM `dossier_revision_receipts`
						WHERE `dossier_id` = job.`dossier_id`
							AND `resulting_revision` = dossier.`revision`
					)
				)
			)
	) THEN RAISE(ABORT, 'analyzed AI source must bind its exact active job lease and revision') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_audit_events`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `event_type` = 'proposal_generation_completed'
			AND `object_ref_type` = 'dossier'
			AND `object_ref_id` = NEW.`dossier_id`
			AND json_extract(`detail`, '$.job_id') = NEW.`job_id`
	) THEN RAISE(ABORT, 'analyzed AI sources are frozen by the completion audit') END;
	SELECT CASE WHEN NEW.`source_ordinal` <> 1 + (
		SELECT COUNT(*) FROM `dossier_ai_proposal_job_sources`
		WHERE `dossier_id` = NEW.`dossier_id` AND `job_id` = NEW.`job_id`
	) THEN RAISE(ABORT, 'analyzed AI sources require contiguous bounded ordering') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `dossier_extraction_results` AS result
		JOIN `dossier_extraction_jobs` AS extraction_job
			ON extraction_job.`dossier_id` = result.`dossier_id`
			AND extraction_job.`id` = result.`extraction_job_id`
		WHERE result.`dossier_id` = NEW.`dossier_id`
			AND result.`id` = NEW.`extraction_result_id`
			AND result.`document_id` = NEW.`document_id`
			AND result.`document_version_id` = NEW.`document_version_id`
			AND result.`character_count` >= NEW.`context_end`
			AND extraction_job.`status` = 'ready'
	) THEN RAISE(ABORT, 'analyzed AI source must bind an exact ready extraction range') END;
	SELECT CASE WHEN (
		SELECT COALESCE(SUM(`context_end` - `context_start`), 0)
		FROM `dossier_ai_proposal_job_sources`
		WHERE `dossier_id` = NEW.`dossier_id` AND `job_id` = NEW.`job_id`
	) + NEW.`context_end` - NEW.`context_start` > 96000
	THEN RAISE(ABORT, 'analyzed AI source context exceeds the bounded job limit') END;
	SELECT CASE WHEN unixepoch(NEW.`created_at`) IS NULL
		THEN RAISE(ABORT, 'analyzed AI source timestamp is invalid') END;
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_job_sources_update_guard`
BEFORE UPDATE ON `dossier_ai_proposal_job_sources`
BEGIN
	SELECT RAISE(ABORT, 'analyzed AI source ranges are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_job_sources_delete_guard`
BEFORE DELETE ON `dossier_ai_proposal_job_sources`
BEGIN
	SELECT RAISE(ABORT, 'analyzed AI source ranges are durable provenance');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_start_guard`
BEFORE UPDATE OF `status` ON `dossier_ai_proposal_jobs`
FOR EACH ROW
WHEN OLD.`status` = 'queued' AND NEW.`status` = 'processing' AND (
	NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = OLD.`dossier_id` AND `revision` = OLD.`expected_dossier_revision`
	)
	OR NOT EXISTS (
		SELECT 1 FROM `dossier_participants`
		WHERE `dossier_id` = OLD.`dossier_id`
			AND `user_id` = OLD.`requested_by_user_id`
			AND `actor_id` = OLD.`requested_by_actor_ref`
			AND `status` = 'active'
			AND `role` IN ('owner','contributor','reviewer')
	)
)
BEGIN
	SELECT RAISE(ABORT, 'stale or unauthorized AI proposal job cannot start');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_no_partial_failure_guard`
BEFORE UPDATE OF `status` ON `dossier_ai_proposal_jobs`
FOR EACH ROW
WHEN NEW.`status` IN ('queued','failed') AND (
	EXISTS (
		SELECT 1 FROM `dossier_ai_proposals`
		WHERE `dossier_id` = OLD.`dossier_id` AND `generation_job_id` = OLD.`id`
	)
	OR EXISTS (
		SELECT 1 FROM `dossier_ai_proposal_job_sources`
		WHERE `dossier_id` = OLD.`dossier_id` AND `job_id` = OLD.`id`
	)
)
BEGIN
	SELECT RAISE(ABORT, 'AI proposal job with analyzed sources or generated proposals cannot fail or retry');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_ready_guard`
BEFORE UPDATE OF `status` ON `dossier_ai_proposal_jobs`
FOR EACH ROW
WHEN OLD.`status` <> 'ready' AND NEW.`status` = 'ready'
BEGIN
	SELECT CASE WHEN (
		SELECT COUNT(*) FROM `dossier_ai_proposal_job_sources`
		WHERE `dossier_id` = NEW.`dossier_id` AND `job_id` = NEW.`id`
	) NOT BETWEEN 1 AND 8
	THEN RAISE(ABORT, 'ready AI proposal job requires its bounded analyzed source ranges') END;
	SELECT CASE WHEN (
		(
			SELECT COUNT(*) FROM `dossier_ai_proposals`
			WHERE `dossier_id` = NEW.`dossier_id` AND `generation_job_id` = NEW.`id`
		) = 0
		AND NOT EXISTS (
			SELECT 1 FROM `dossiers`
			WHERE `id` = NEW.`dossier_id`
				AND `revision` = NEW.`expected_dossier_revision`
		)
	) OR (
		(
			SELECT COUNT(*) FROM `dossier_ai_proposals`
			WHERE `dossier_id` = NEW.`dossier_id` AND `generation_job_id` = NEW.`id`
		) > 0
		AND NOT EXISTS (
			SELECT 1 FROM `dossiers` AS dossier
			JOIN `dossier_revision_receipts` AS receipt
				ON receipt.`dossier_id` = dossier.`id`
				AND receipt.`resulting_revision` = dossier.`revision`
			WHERE dossier.`id` = NEW.`dossier_id`
				AND dossier.`revision` = NEW.`expected_dossier_revision` + 1
		)
	) THEN RAISE(ABORT, 'ready AI proposal job requires the exact zero-result or candidate revision receipt') END;
	SELECT CASE WHEN (
		SELECT COUNT(*) FROM `dossier_ai_proposals`
		WHERE `dossier_id` = NEW.`dossier_id` AND `generation_job_id` = NEW.`id`
	) > 20 THEN RAISE(ABORT, 'ready AI proposal job exceeds the bounded candidate limit') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS event
		WHERE event.`dossier_id` = NEW.`dossier_id`
			AND event.`dossier_revision` = NEW.`expected_dossier_revision` + CASE WHEN EXISTS (
				SELECT 1 FROM `dossier_ai_proposals`
				WHERE `dossier_id` = NEW.`dossier_id` AND `generation_job_id` = NEW.`id`
			) THEN 1 ELSE 0 END
			AND event.`event_type` = 'proposal_generation_completed'
			AND event.`object_ref_type` = 'dossier'
			AND event.`object_ref_id` = NEW.`dossier_id`
			AND json_extract(event.`detail`, '$.job_id') = NEW.`id`
			AND event.`actor_user_id` = NEW.`requested_by_user_id`
			AND event.`actor_ref` = NEW.`requested_by_actor_ref`
			AND event.`occurred_at` = NEW.`completed_at`
			AND event.`summary_code` = CASE WHEN EXISTS (
				SELECT 1 FROM `dossier_ai_proposals`
				WHERE `dossier_id` = NEW.`dossier_id` AND `generation_job_id` = NEW.`id`
			) THEN 'AI_PROPOSAL_GENERATION_READY' ELSE 'AI_PROPOSAL_GENERATION_NO_CANDIDATES' END
			AND json_extract(event.`detail`, '$.model_receipt_digest') = NEW.`provider_receipt_digest`
	) THEN RAISE(ABORT, 'ready AI proposal job requires its exact bounded completion audit') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_ai_proposals` AS proposal
		WHERE proposal.`dossier_id` = NEW.`dossier_id`
			AND proposal.`generation_job_id` = NEW.`id`
			AND (
				proposal.`review_state` <> 'pending'
				OR (
					SELECT COUNT(*) FROM `dossier_ai_proposal_versions`
					WHERE `dossier_id` = proposal.`dossier_id` AND `proposal_id` = proposal.`id`
				) <> 1
				OR (
					SELECT COUNT(*) FROM `dossier_ai_proposal_anchors`
					WHERE `dossier_id` = proposal.`dossier_id` AND `proposal_id` = proposal.`id`
				) <> 1
				OR (
					SELECT COUNT(*) FROM `dossier_audit_events`
					WHERE `dossier_id` = proposal.`dossier_id`
						AND `dossier_revision` = NEW.`expected_dossier_revision` + 1
						AND `event_type` = 'proposal_reviewed'
						AND `object_ref_type` = 'ai_proposal'
						AND `object_ref_id` = proposal.`id`
						AND `actor_ref` = NEW.`requested_by_actor_ref`
				) <> 1
			)
	) THEN RAISE(ABORT, 'ready AI proposal job requires exact grounded pending proposals and audits') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1
		FROM `dossier_ai_proposal_anchors` AS source
		JOIN `dossier_source_anchors` AS anchor
			ON anchor.`dossier_id` = source.`dossier_id`
			AND anchor.`id` = source.`source_anchor_id`
		JOIN `dossier_ai_proposals` AS proposal
			ON proposal.`dossier_id` = source.`dossier_id`
			AND proposal.`id` = source.`proposal_id`
		WHERE proposal.`dossier_id` = NEW.`dossier_id`
			AND proposal.`generation_job_id` = NEW.`id`
			AND (
				anchor.`creator` <> 'ai_proposal'
				OR anchor.`review_state` <> 'pending'
				OR anchor.`created_by_actor_ref` <> NEW.`requested_by_actor_ref`
				OR NOT EXISTS (
					SELECT 1 FROM `dossier_ai_proposal_versions` AS version
					WHERE version.`dossier_id` = source.`dossier_id`
						AND version.`proposal_id` = source.`proposal_id`
						AND version.`document_version_id` = anchor.`document_version_id`
				)
			)
	) THEN RAISE(ABORT, 'ready AI proposal job contains non-exact generated source anchors') END;
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_jobs_delete_guard`
BEFORE DELETE ON `dossier_ai_proposal_jobs`
BEGIN
	SELECT RAISE(ABORT, 'AI proposal jobs are durable idempotency and recovery records');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposals_generation_job_guard`
BEFORE INSERT ON `dossier_ai_proposals`
FOR EACH ROW
WHEN NEW.`generation_job_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1
	FROM `dossier_ai_proposal_jobs` AS job
	JOIN `dossiers` AS dossier ON dossier.`id` = job.`dossier_id`
	WHERE job.`dossier_id` = NEW.`dossier_id`
		AND job.`id` = NEW.`generation_job_id`
		AND job.`status` = 'processing'
		AND dossier.`revision` = job.`expected_dossier_revision` + 1
		AND NOT EXISTS (
			SELECT 1 FROM `dossier_revision_receipts`
			WHERE `dossier_id` = job.`dossier_id`
				AND `resulting_revision` = dossier.`revision`
		)
		AND job.`requested_by_actor_ref` = NEW.`created_by_actor_ref`
		AND job.`model_provider` = NEW.`model_provider`
		AND job.`model_name` = NEW.`model_name`
		AND job.`model_configuration_digest` = NEW.`model_configuration_digest`
		AND (
			SELECT COUNT(*) FROM `dossier_ai_proposals`
			WHERE `dossier_id` = job.`dossier_id`
				AND `generation_job_id` = job.`id`
		) < 20
)
BEGIN
	SELECT RAISE(ABORT, 'generated proposal must bind its exact processing job and revision batch');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposals_insert_guard`
BEFORE INSERT ON `dossier_ai_proposals`
FOR EACH ROW
WHEN NEW.`review_state` <> 'pending'
	OR NEW.`reviewing_user_id` IS NOT NULL
	OR NEW.`reviewing_actor_ref` IS NOT NULL
	OR NEW.`reviewed_at` IS NOT NULL
	OR NEW.`accepted_object_type` IS NOT NULL
	OR NEW.`accepted_object_id` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'AI proposals must be inserted pending and unreviewed');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposals_identity_guard`
BEFORE UPDATE ON `dossier_ai_proposals`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id`
	OR NEW.`dossier_id` IS NOT OLD.`dossier_id`
	OR NEW.`generation_job_id` IS NOT OLD.`generation_job_id`
	OR NEW.`proposal_type` IS NOT OLD.`proposal_type`
	OR NEW.`proposed_value` IS NOT OLD.`proposed_value`
	OR NEW.`confidence_category` IS NOT OLD.`confidence_category`
	OR NEW.`confidence_score` IS NOT OLD.`confidence_score`
	OR NEW.`model_provider` IS NOT OLD.`model_provider`
	OR NEW.`model_name` IS NOT OLD.`model_name`
	OR NEW.`model_configuration_digest` IS NOT OLD.`model_configuration_digest`
	OR NEW.`created_by_actor_ref` IS NOT OLD.`created_by_actor_ref`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'AI proposal content and model provenance are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposals_review_guard`
BEFORE UPDATE ON `dossier_ai_proposals`
FOR EACH ROW
BEGIN
	SELECT CASE WHEN OLD.`review_state` <> 'pending'
		OR NEW.`review_state` NOT IN ('accepted','rejected')
		OR NEW.`reviewing_user_id` IS NULL
		OR NEW.`reviewing_actor_ref` IS NULL
		OR NEW.`reviewed_at` IS NULL
		OR NOT EXISTS (
			SELECT 1 FROM `dossier_participants`
			WHERE `dossier_id` = NEW.`dossier_id`
				AND `user_id` = NEW.`reviewing_user_id`
				AND `actor_id` = NEW.`reviewing_actor_ref`
				AND `status` = 'active'
				AND `role` IN ('owner','contributor','reviewer')
		)
	THEN RAISE(ABORT, 'AI proposal review requires one bound active reviewer') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossier_ai_proposal_versions`
		WHERE `dossier_id` = NEW.`dossier_id` AND `proposal_id` = NEW.`id`
	) OR NOT EXISTS (
		SELECT 1 FROM `dossier_ai_proposal_anchors`
		WHERE `dossier_id` = NEW.`dossier_id` AND `proposal_id` = NEW.`id`
	) THEN RAISE(ABORT, 'reviewed AI proposal requires an exact version and source anchor') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_ai_proposal_anchors` AS source
		JOIN `dossier_source_anchors` AS anchor
			ON anchor.`dossier_id` = source.`dossier_id`
			AND anchor.`id` = source.`source_anchor_id`
		WHERE source.`dossier_id` = NEW.`dossier_id`
			AND source.`proposal_id` = NEW.`id`
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_ai_proposal_versions` AS version
				WHERE version.`dossier_id` = source.`dossier_id`
					AND version.`proposal_id` = source.`proposal_id`
					AND version.`document_version_id` = anchor.`document_version_id`
			)
	) THEN RAISE(ABORT, 'AI proposal source anchors must map to declared source versions') END;
	SELECT CASE WHEN NEW.`review_state` = 'accepted' AND EXISTS (
		SELECT 1 FROM `dossier_ai_proposal_anchors` AS source
		JOIN `dossier_source_anchors` AS anchor
			ON anchor.`dossier_id` = source.`dossier_id`
			AND anchor.`id` = source.`source_anchor_id`
		WHERE source.`dossier_id` = NEW.`dossier_id`
			AND source.`proposal_id` = NEW.`id`
			AND anchor.`review_state` <> 'accepted'
	) THEN RAISE(ABORT, 'accepted AI proposal requires only accepted source anchors') END;
	SELECT CASE WHEN NEW.`review_state` = 'accepted' AND (
		NEW.`accepted_object_type` IS NULL OR NEW.`accepted_object_id` IS NULL
	) THEN RAISE(ABORT, 'accepted AI proposal requires an accepted object') END;
	SELECT CASE WHEN NEW.`review_state` = 'rejected' AND (
		NEW.`accepted_object_type` IS NOT NULL OR NEW.`accepted_object_id` IS NOT NULL
	) THEN RAISE(ABORT, 'rejected AI proposal cannot name an accepted object') END;
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_versions_insert_guard`
BEFORE INSERT ON `dossier_ai_proposal_versions`
FOR EACH ROW
WHEN (SELECT `review_state` FROM `dossier_ai_proposals`
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`proposal_id`) <> 'pending'
	OR EXISTS (
		SELECT 1
		FROM `dossier_ai_proposals` AS proposal
		JOIN `dossier_ai_proposal_jobs` AS job
			ON job.`dossier_id` = proposal.`dossier_id`
			AND job.`id` = proposal.`generation_job_id`
		WHERE proposal.`dossier_id` = NEW.`dossier_id`
			AND proposal.`id` = NEW.`proposal_id`
			AND proposal.`generation_job_id` IS NOT NULL
			AND (
				job.`status` <> 'processing'
				OR EXISTS (
					SELECT 1 FROM `dossier_revision_receipts`
					WHERE `dossier_id` = job.`dossier_id`
						AND `resulting_revision` = job.`expected_dossier_revision` + 1
				)
				OR EXISTS (
					SELECT 1 FROM `dossier_audit_events`
					WHERE `dossier_id` = job.`dossier_id`
						AND `event_type` = 'proposal_generation_completed'
						AND json_extract(`detail`, '$.job_id') = job.`id`
				)
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'proposal sources can only be assembled while pending');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_versions_generation_source_guard`
BEFORE INSERT ON `dossier_ai_proposal_versions`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_ai_proposals`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`proposal_id`
		AND `generation_job_id` IS NOT NULL
) AND NOT EXISTS (
	SELECT 1
	FROM `dossier_ai_proposals` AS proposal
	JOIN `dossier_ai_proposal_job_sources` AS analyzed
		ON analyzed.`dossier_id` = proposal.`dossier_id`
		AND analyzed.`job_id` = proposal.`generation_job_id`
	WHERE proposal.`dossier_id` = NEW.`dossier_id`
		AND proposal.`id` = NEW.`proposal_id`
		AND analyzed.`document_id` = NEW.`document_id`
		AND analyzed.`document_version_id` = NEW.`document_version_id`
)
BEGIN
	SELECT RAISE(ABORT, 'generated proposal version must be one exact analyzed source');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_versions_update_guard`
BEFORE UPDATE ON `dossier_ai_proposal_versions`
BEGIN
	SELECT RAISE(ABORT, 'proposal source versions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_versions_delete_guard`
BEFORE DELETE ON `dossier_ai_proposal_versions`
FOR EACH ROW
WHEN (SELECT `review_state` FROM `dossier_ai_proposals`
	WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`proposal_id`) <> 'pending'
	OR EXISTS (
		SELECT 1
		FROM `dossier_ai_proposals` AS proposal
		JOIN `dossier_ai_proposal_jobs` AS job
			ON job.`dossier_id` = proposal.`dossier_id`
			AND job.`id` = proposal.`generation_job_id`
		WHERE proposal.`dossier_id` = OLD.`dossier_id`
			AND proposal.`id` = OLD.`proposal_id`
			AND proposal.`generation_job_id` IS NOT NULL
			AND (
				job.`status` <> 'processing'
				OR EXISTS (
					SELECT 1 FROM `dossier_revision_receipts`
					WHERE `dossier_id` = job.`dossier_id`
						AND `resulting_revision` = job.`expected_dossier_revision` + 1
				)
				OR EXISTS (
					SELECT 1 FROM `dossier_audit_events`
					WHERE `dossier_id` = job.`dossier_id`
						AND `event_type` = 'proposal_generation_completed'
						AND json_extract(`detail`, '$.job_id') = job.`id`
				)
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'reviewed or completed proposal source versions cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_anchors_insert_guard`
BEFORE INSERT ON `dossier_ai_proposal_anchors`
FOR EACH ROW
WHEN (SELECT `review_state` FROM `dossier_ai_proposals`
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`proposal_id`) <> 'pending'
	OR EXISTS (
		SELECT 1
		FROM `dossier_ai_proposals` AS proposal
		JOIN `dossier_ai_proposal_jobs` AS job
			ON job.`dossier_id` = proposal.`dossier_id`
			AND job.`id` = proposal.`generation_job_id`
		WHERE proposal.`dossier_id` = NEW.`dossier_id`
			AND proposal.`id` = NEW.`proposal_id`
			AND proposal.`generation_job_id` IS NOT NULL
			AND (
				job.`status` <> 'processing'
				OR EXISTS (
					SELECT 1 FROM `dossier_revision_receipts`
					WHERE `dossier_id` = job.`dossier_id`
						AND `resulting_revision` = job.`expected_dossier_revision` + 1
				)
				OR EXISTS (
					SELECT 1 FROM `dossier_audit_events`
					WHERE `dossier_id` = job.`dossier_id`
						AND `event_type` = 'proposal_generation_completed'
						AND json_extract(`detail`, '$.job_id') = job.`id`
				)
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'proposal sources can only be assembled while pending');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_anchors_generation_source_guard`
BEFORE INSERT ON `dossier_ai_proposal_anchors`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_ai_proposals`
	WHERE `dossier_id` = NEW.`dossier_id`
		AND `id` = NEW.`proposal_id`
		AND `generation_job_id` IS NOT NULL
) AND NOT EXISTS (
	SELECT 1
	FROM `dossier_ai_proposals` AS proposal
	JOIN `dossier_source_anchors` AS anchor
		ON anchor.`dossier_id` = proposal.`dossier_id`
		AND anchor.`id` = NEW.`source_anchor_id`
	JOIN `dossier_ai_proposal_job_sources` AS analyzed
		ON analyzed.`dossier_id` = proposal.`dossier_id`
		AND analyzed.`job_id` = proposal.`generation_job_id`
		AND analyzed.`document_id` = anchor.`document_id`
		AND analyzed.`document_version_id` = anchor.`document_version_id`
		AND anchor.`character_start` >= analyzed.`context_start`
		AND anchor.`character_end` <= analyzed.`context_end`
	JOIN `dossier_extraction_results` AS extraction
		ON extraction.`dossier_id` = analyzed.`dossier_id`
		AND extraction.`id` = analyzed.`extraction_result_id`
		AND extraction.`document_id` = anchor.`document_id`
		AND extraction.`document_version_id` = anchor.`document_version_id`
		AND extraction.`extractor_version` = anchor.`extraction_version`
	WHERE proposal.`dossier_id` = NEW.`dossier_id`
		AND proposal.`id` = NEW.`proposal_id`
)
BEGIN
	SELECT RAISE(ABORT, 'generated proposal anchor must bind one exact analyzed extraction result and range');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_anchors_update_guard`
BEFORE UPDATE ON `dossier_ai_proposal_anchors`
BEGIN
	SELECT RAISE(ABORT, 'proposal source anchors are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposal_anchors_delete_guard`
BEFORE DELETE ON `dossier_ai_proposal_anchors`
FOR EACH ROW
WHEN (SELECT `review_state` FROM `dossier_ai_proposals`
	WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`proposal_id`) <> 'pending'
	OR EXISTS (
		SELECT 1
		FROM `dossier_ai_proposals` AS proposal
		JOIN `dossier_ai_proposal_jobs` AS job
			ON job.`dossier_id` = proposal.`dossier_id`
			AND job.`id` = proposal.`generation_job_id`
		WHERE proposal.`dossier_id` = OLD.`dossier_id`
			AND proposal.`id` = OLD.`proposal_id`
			AND proposal.`generation_job_id` IS NOT NULL
			AND (
				job.`status` <> 'processing'
				OR EXISTS (
					SELECT 1 FROM `dossier_revision_receipts`
					WHERE `dossier_id` = job.`dossier_id`
						AND `resulting_revision` = job.`expected_dossier_revision` + 1
				)
				OR EXISTS (
					SELECT 1 FROM `dossier_audit_events`
					WHERE `dossier_id` = job.`dossier_id`
						AND `event_type` = 'proposal_generation_completed'
						AND json_extract(`detail`, '$.job_id') = job.`id`
				)
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'reviewed or completed proposal source anchors cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposals_delete_guard`
BEFORE DELETE ON `dossier_ai_proposals`
BEGIN
	SELECT RAISE(ABORT, 'AI proposals are governed provenance and cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_ai_proposals_accept_guard`
BEFORE UPDATE ON `dossier_ai_proposals`
FOR EACH ROW
WHEN NEW.`review_state` = 'accepted'
BEGIN
	SELECT CASE WHEN NEW.`reviewing_actor_ref` IS NULL OR NEW.`reviewed_at` IS NULL
		OR NEW.`accepted_object_type` IS NULL OR NEW.`accepted_object_id` IS NULL
	THEN RAISE(ABORT, 'accepted AI proposal requires explicit review and an accepted object') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'participant' AND NOT EXISTS (
		SELECT 1 FROM `dossier_participants` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`accepted_object_id`
	) THEN RAISE(ABORT, 'accepted AI proposal participant is outside the dossier') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'document' AND NOT EXISTS (
		SELECT 1 FROM `dossier_documents`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `id` = NEW.`accepted_object_id`
			AND `is_provisional` = false
	) THEN RAISE(ABORT, 'accepted AI proposal document is outside the dossier or not finalized') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'professional_assertion' AND NOT EXISTS (
		SELECT 1 FROM `dossier_professional_assertions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`accepted_object_id`
	) THEN RAISE(ABORT, 'accepted AI proposal assertion is outside the dossier') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'evidence_link' AND NOT EXISTS (
		SELECT 1 FROM `dossier_evidence_links` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`accepted_object_id`
	) THEN RAISE(ABORT, 'accepted AI proposal evidence is outside the dossier') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'information_request' AND NOT EXISTS (
		SELECT 1 FROM `dossier_information_requests` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`accepted_object_id`
	) THEN RAISE(ABORT, 'accepted AI proposal request is outside the dossier') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'deadline_reference' AND NOT EXISTS (
		SELECT 1 FROM `dossier_deadline_references` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`accepted_object_id`
	) THEN RAISE(ABORT, 'accepted AI proposal deadline is outside the dossier') END;
	SELECT CASE WHEN NEW.`accepted_object_type` = 'decision_package_reference' AND NOT EXISTS (
		SELECT 1 FROM `dossier_decision_package_references` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`accepted_object_id`
	) THEN RAISE(ABORT, 'accepted AI proposal package is outside the dossier') END;
END;--> statement-breakpoint
-- Snapshot rows are assembled while unsealed. The one permitted update seals
-- the exact manifest; base and normalized rows are immutable thereafter.
CREATE TRIGGER `dossier_snapshots_update_guard`
BEFORE UPDATE ON `dossier_snapshots`
FOR EACH ROW
WHEN NOT (
	OLD.`sealed` = false AND NEW.`sealed` = true
	AND NEW.`sealed_at` IS NOT NULL AND NEW.`sealed_by_actor_ref` IS NOT NULL
	AND NEW.`id` IS OLD.`id`
	AND NEW.`dossier_id` IS OLD.`dossier_id`
	AND NEW.`dossier_revision` IS OLD.`dossier_revision`
	AND NEW.`simulation_inputs` IS OLD.`simulation_inputs`
	AND NEW.`deterministic_receipts` IS OLD.`deterministic_receipts`
	AND NEW.`status` IS OLD.`status`
	AND NEW.`readiness` IS OLD.`readiness`
	AND NEW.`approver_records` IS OLD.`approver_records`
	AND NEW.`locale` IS OLD.`locale`
	AND NEW.`audience` IS OLD.`audience`
	AND NEW.`classification` IS OLD.`classification`
	AND NEW.`redaction_profile_id` IS OLD.`redaction_profile_id`
	AND NEW.`contract_version` IS OLD.`contract_version`
	AND NEW.`report_model_schema_version` IS OLD.`report_model_schema_version`
	AND NEW.`renderer_version` IS OLD.`renderer_version`
	AND NEW.`build_version` IS OLD.`build_version`
	AND NEW.`manifest_object_reference` IS OLD.`manifest_object_reference`
	AND NEW.`manifest_byte_length` IS OLD.`manifest_byte_length`
	AND NEW.`manifest_digest` IS OLD.`manifest_digest`
	AND NEW.`created_by_actor_ref` IS OLD.`created_by_actor_ref`
	AND NEW.`created_at` IS OLD.`created_at`
)
BEGIN
	SELECT RAISE(ABORT, 'snapshot is immutable except for its one-way seal');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshots_delete_guard`
BEFORE DELETE ON `dossier_snapshots`
FOR EACH ROW
WHEN OLD.`sealed` = true
	OR EXISTS (
		SELECT 1 FROM `dossier_governed_outputs`
		WHERE `dossier_id` = OLD.`dossier_id` AND `snapshot_id` = OLD.`id`
	)
BEGIN
	SELECT RAISE(ABORT, 'sealed or output-bound snapshots are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshots_seal_guard`
BEFORE UPDATE OF `sealed` ON `dossier_snapshots`
FOR EACH ROW
WHEN OLD.`sealed` = false AND NEW.`sealed` = true
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`dossier_revision`
	) THEN RAISE(ABORT, 'snapshot must seal the current dossier revision') END;
	SELECT CASE WHEN (
		SELECT `status` FROM `dossiers` WHERE `id` = NEW.`dossier_id`
	) IS NOT NEW.`status`
	THEN RAISE(ABORT, 'snapshot status must equal the current dossier status') END;
	SELECT CASE WHEN NOT json_valid(NEW.`readiness`)
		OR json_type(NEW.`readiness`) IS NOT 'object'
		OR json_type(NEW.`readiness`, '$.schema_version') IS NOT 'integer'
		OR json_extract(NEW.`readiness`, '$.schema_version') IS NOT 1
		OR json_type(NEW.`readiness`, '$.dossier_id') IS NOT 'text'
		OR json_extract(NEW.`readiness`, '$.dossier_id') IS NOT NEW.`dossier_id`
		OR json_type(NEW.`readiness`, '$.computed_from_revision') IS NOT 'integer'
		OR json_extract(NEW.`readiness`, '$.computed_from_revision') IS NOT NEW.`dossier_revision`
	THEN RAISE(ABORT, 'snapshot readiness must bind the exact dossier revision') END;
	SELECT CASE WHEN (
		SELECT COUNT(*) FROM json_each(NEW.`readiness`)
	) <> 6 OR EXISTS (
		SELECT 1 FROM json_each(NEW.`readiness`) AS member
		WHERE member.`key` NOT IN (
			'schema_version','dossier_id','computed_from_revision',
			'evaluated_at','ready','dimensions'
		)
	) THEN RAISE(ABORT, 'snapshot readiness must have the exact V1 object shape') END;
	SELECT CASE WHEN json_type(NEW.`readiness`, '$.evaluated_at') <> 'text'
		OR unixepoch(json_extract(NEW.`readiness`, '$.evaluated_at')) IS NULL
		OR json_type(NEW.`readiness`, '$.ready') NOT IN ('true','false')
		OR json_type(NEW.`readiness`, '$.dimensions') <> 'array'
		OR json_array_length(NEW.`readiness`, '$.dimensions') <> 10
	THEN RAISE(ABORT, 'snapshot readiness requires evaluated_at, ready, and all ten dimensions') END;
	SELECT CASE WHEN json_extract(NEW.`readiness`, '$.dimensions[0].dimension') <> 'document_completeness'
		OR json_extract(NEW.`readiness`, '$.dimensions[1].dimension') <> 'information_requests'
		OR json_extract(NEW.`readiness`, '$.dimensions[2].dimension') <> 'ai_proposals'
		OR json_extract(NEW.`readiness`, '$.dimensions[3].dimension') <> 'contradictions'
		OR json_extract(NEW.`readiness`, '$.dimensions[4].dimension') <> 'critical_deadlines'
		OR json_extract(NEW.`readiness`, '$.dimensions[5].dimension') <> 'source_provenance'
		OR json_extract(NEW.`readiness`, '$.dimensions[6].dimension') <> 'decision_graph'
		OR json_extract(NEW.`readiness`, '$.dimensions[7].dimension') <> 'simulation_tests'
		OR json_extract(NEW.`readiness`, '$.dimensions[8].dimension') <> 'report_freshness'
		OR json_extract(NEW.`readiness`, '$.dimensions[9].dimension') <> 'reviewer_approval'
	THEN RAISE(ABORT, 'snapshot readiness dimensions must be complete and canonically ordered') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM json_each(NEW.`readiness`, '$.dimensions') AS dimension
		WHERE json_type(dimension.`value`) <> 'object'
			OR (SELECT COUNT(*) FROM json_each(dimension.`value`)) <> 3
			OR EXISTS (
				SELECT 1 FROM json_each(dimension.`value`) AS member
				WHERE member.`key` NOT IN ('dimension','state','reasons')
			)
			OR json_type(dimension.`value`, '$.dimension') <> 'text'
			OR json_type(dimension.`value`, '$.state') <> 'text'
			OR json_extract(dimension.`value`, '$.state') NOT IN ('ready','blocked','not_applicable')
			OR json_type(dimension.`value`, '$.reasons') <> 'array'
			OR (
				(json_extract(dimension.`value`, '$.state') = 'blocked')
				<> (json_array_length(dimension.`value`, '$.reasons') > 0)
			)
	) THEN RAISE(ABORT, 'snapshot readiness dimension shape or state is invalid') END;
	SELECT CASE WHEN json_extract(NEW.`readiness`, '$.ready') <> NOT EXISTS (
		SELECT 1 FROM json_each(NEW.`readiness`, '$.dimensions') AS dimension
		WHERE json_extract(dimension.`value`, '$.state') = 'blocked'
	) THEN RAISE(ABORT, 'snapshot readiness ready flag must be derived from its dimensions') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1
		FROM json_each(NEW.`readiness`, '$.dimensions') AS dimension
		JOIN json_each(dimension.`value`, '$.reasons') AS reason
		WHERE json_type(reason.`value`) <> 'object'
			OR (SELECT COUNT(*) FROM json_each(reason.`value`)) <> 5
			OR EXISTS (
				SELECT 1 FROM json_each(reason.`value`) AS member
				WHERE member.`key` NOT IN (
					'code','explanation','deep_link','related_object_type','related_object_id'
				)
			)
			OR json_type(reason.`value`, '$.code') <> 'text'
			OR json_type(reason.`value`, '$.explanation') <> 'text'
			OR json_type(reason.`value`, '$.deep_link') <> 'text'
			OR json_extract(reason.`value`, '$.code') NOT IN (
				'DOCUMENT_REQUIRED_MISSING','DOCUMENT_REVIEW_REQUIRED',
				'INFORMATION_REQUEST_OPEN','INFORMATION_REQUEST_OVERDUE',
				'AI_PROPOSAL_PENDING','CONTRADICTION_UNRESOLVED',
				'CRITICAL_DEADLINE_MISSING','CRITICAL_DEADLINE_OVERDUE',
				'SOURCE_ANCHOR_MISSING','SOURCE_VERSION_STALE',
				'DECISION_GRAPH_INVALID','SIMULATION_REQUIRED','SIMULATION_FAILED',
				'OUTPUT_REQUIRED','OUTPUT_STALE','REVIEWER_APPROVAL_MISSING'
			)
			OR json_extract(dimension.`value`, '$.dimension') <> CASE json_extract(reason.`value`, '$.code')
				WHEN 'DOCUMENT_REQUIRED_MISSING' THEN 'document_completeness'
				WHEN 'DOCUMENT_REVIEW_REQUIRED' THEN 'document_completeness'
				WHEN 'INFORMATION_REQUEST_OPEN' THEN 'information_requests'
				WHEN 'INFORMATION_REQUEST_OVERDUE' THEN 'information_requests'
				WHEN 'AI_PROPOSAL_PENDING' THEN 'ai_proposals'
				WHEN 'CONTRADICTION_UNRESOLVED' THEN 'contradictions'
				WHEN 'CRITICAL_DEADLINE_MISSING' THEN 'critical_deadlines'
				WHEN 'CRITICAL_DEADLINE_OVERDUE' THEN 'critical_deadlines'
				WHEN 'SOURCE_ANCHOR_MISSING' THEN 'source_provenance'
				WHEN 'SOURCE_VERSION_STALE' THEN 'source_provenance'
				WHEN 'DECISION_GRAPH_INVALID' THEN 'decision_graph'
				WHEN 'SIMULATION_REQUIRED' THEN 'simulation_tests'
				WHEN 'SIMULATION_FAILED' THEN 'simulation_tests'
				WHEN 'OUTPUT_REQUIRED' THEN 'report_freshness'
				WHEN 'OUTPUT_STALE' THEN 'report_freshness'
				WHEN 'REVIEWER_APPROVAL_MISSING' THEN 'reviewer_approval'
			END
			OR json_extract(reason.`value`, '$.explanation') <> CASE json_extract(reason.`value`, '$.code')
				WHEN 'DOCUMENT_REQUIRED_MISSING' THEN 'A required source document is missing.'
				WHEN 'DOCUMENT_REVIEW_REQUIRED' THEN 'A required document has not completed professional review.'
				WHEN 'INFORMATION_REQUEST_OPEN' THEN 'Required information is still outstanding.'
				WHEN 'INFORMATION_REQUEST_OVERDUE' THEN 'A required information request is overdue.'
				WHEN 'AI_PROPOSAL_PENDING' THEN 'An AI proposal awaits explicit professional review.'
				WHEN 'CONTRADICTION_UNRESOLVED' THEN 'A material contradiction remains unresolved.'
				WHEN 'CRITICAL_DEADLINE_MISSING' THEN 'A required critical deadline has not been recorded.'
				WHEN 'CRITICAL_DEADLINE_OVERDUE' THEN 'A critical workspace deadline is overdue.'
				WHEN 'SOURCE_ANCHOR_MISSING' THEN 'An accepted professional assertion lacks exact source provenance.'
				WHEN 'SOURCE_VERSION_STALE' THEN 'An accepted assertion depends on a superseded source version and requires review.'
				WHEN 'DECISION_GRAPH_INVALID' THEN 'A linked decision graph has not passed canonical validation.'
				WHEN 'SIMULATION_REQUIRED' THEN 'A required deterministic simulation or package test has not run.'
				WHEN 'SIMULATION_FAILED' THEN 'A required deterministic simulation or package test failed.'
				WHEN 'OUTPUT_REQUIRED' THEN 'A governed output has not been generated from the current dossier snapshot.'
				WHEN 'OUTPUT_STALE' THEN 'The governed output does not represent the current authoritative dossier revision.'
				WHEN 'REVIEWER_APPROVAL_MISSING' THEN 'The current governed output lacks an attributable reviewer approval.'
			END
			OR json_extract(reason.`value`, '$.deep_link') LIKE '//%'
			OR instr(json_extract(reason.`value`, '$.deep_link'), CASE json_extract(reason.`value`, '$.code')
				WHEN 'DOCUMENT_REQUIRED_MISSING' THEN '/documents'
				WHEN 'DOCUMENT_REVIEW_REQUIRED' THEN '/documents'
				WHEN 'INFORMATION_REQUEST_OPEN' THEN '/requests'
				WHEN 'INFORMATION_REQUEST_OVERDUE' THEN '/requests'
				WHEN 'AI_PROPOSAL_PENDING' THEN '/evidence/proposals'
				WHEN 'CONTRADICTION_UNRESOLVED' THEN '/evidence/contradictions'
				WHEN 'CRITICAL_DEADLINE_MISSING' THEN '/requests-deadlines'
				WHEN 'CRITICAL_DEADLINE_OVERDUE' THEN '/requests-deadlines'
				WHEN 'SOURCE_ANCHOR_MISSING' THEN '/evidence'
				WHEN 'SOURCE_VERSION_STALE' THEN '/evidence'
				WHEN 'DECISION_GRAPH_INVALID' THEN '/decision-packages'
				WHEN 'SIMULATION_REQUIRED' THEN '/decision-packages'
				WHEN 'SIMULATION_FAILED' THEN '/decision-packages'
				WHEN 'OUTPUT_REQUIRED' THEN '/outputs'
				WHEN 'OUTPUT_STALE' THEN '/outputs'
				WHEN 'REVIEWER_APPROVAL_MISSING' THEN '/outputs/approvals'
			END) <> 1
			OR json_type(reason.`value`, '$.related_object_type') NOT IN ('text','null')
			OR json_type(reason.`value`, '$.related_object_id') NOT IN ('text','null')
			OR (
				(json_type(reason.`value`, '$.related_object_type') = 'null')
				<> (json_type(reason.`value`, '$.related_object_id') = 'null')
			)
			OR (json_type(reason.`value`, '$.related_object_type') = 'text'
				AND json_extract(reason.`value`, '$.related_object_type') NOT IN (
					'dossier','participant','status_transition','document','document_version',
					'source_anchor','professional_assertion','evidence_link','information_request',
					'deadline_reference','decision_package_reference','ai_proposal',
					'dossier_snapshot','governed_output','audit_event'
				))
	) THEN RAISE(ABORT, 'snapshot readiness reasons must match the exact V1 registry') END;
	SELECT CASE WHEN NOT json_valid(NEW.`approver_records`)
		OR json_type(NEW.`approver_records`) <> 'array'
		OR EXISTS (
			SELECT 1 FROM json_each(NEW.`approver_records`) AS entry
			WHERE json_type(entry.`value`) <> 'object'
				OR (SELECT COUNT(*) FROM json_each(entry.`value`)) <> 3
				OR EXISTS (
					SELECT 1 FROM json_each(entry.`value`) AS member
					WHERE member.`key` NOT IN ('reviewer_actor_id','approved_at','output_id')
				)
				OR json_type(entry.`value`, '$.reviewer_actor_id') IS NULL
				OR json_type(entry.`value`, '$.reviewer_actor_id') <> 'text'
				OR json_type(entry.`value`, '$.approved_at') IS NULL
				OR json_type(entry.`value`, '$.approved_at') <> 'text'
				OR unixepoch(json_extract(entry.`value`, '$.approved_at')) IS NULL
				OR json_type(entry.`value`, '$.output_id') IS NULL
				OR json_type(entry.`value`, '$.output_id') NOT IN ('text','null')
				OR NOT EXISTS (
					SELECT 1 FROM `dossier_participants`
					WHERE `dossier_id` = NEW.`dossier_id`
						AND `actor_id` = json_extract(entry.`value`, '$.reviewer_actor_id')
						AND `role` = 'reviewer'
						AND `status` = 'active'
				)
				OR (json_type(entry.`value`, '$.output_id') = 'text' AND NOT EXISTS (
					SELECT 1 FROM `dossier_governed_outputs`
					WHERE `dossier_id` = NEW.`dossier_id`
						AND `id` = json_extract(entry.`value`, '$.output_id')
				))
		)
	THEN RAISE(ABORT, 'snapshot approver records must match the governed contract') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_document_current_versions` AS current_version
		WHERE current_version.`dossier_id` = NEW.`dossier_id`
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_snapshot_document_versions` AS snapshot_version
				WHERE snapshot_version.`dossier_id` = NEW.`dossier_id`
					AND snapshot_version.`snapshot_id` = NEW.`id`
					AND snapshot_version.`document_id` = current_version.`document_id`
					AND snapshot_version.`document_version_id` = current_version.`document_version_id`
			)
	) OR EXISTS (
		SELECT 1 FROM `dossier_snapshot_document_versions` AS snapshot_version
		WHERE snapshot_version.`dossier_id` = NEW.`dossier_id`
			AND snapshot_version.`snapshot_id` = NEW.`id`
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_document_current_versions` AS current_version
				WHERE current_version.`dossier_id` = NEW.`dossier_id`
					AND current_version.`document_id` = snapshot_version.`document_id`
					AND current_version.`document_version_id` = snapshot_version.`document_version_id`
			)
	) THEN RAISE(ABORT, 'snapshot document manifest must equal all current document versions') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_snapshot_assertions` AS item
		LEFT JOIN `dossier_professional_assertions` AS assertion
			ON assertion.`dossier_id` = item.`dossier_id` AND assertion.`id` = item.`assertion_id`
		WHERE item.`dossier_id` = NEW.`dossier_id` AND item.`snapshot_id` = NEW.`id`
			AND (assertion.`id` IS NULL OR assertion.`status` <> 'accepted')
	) OR EXISTS (
		SELECT 1 FROM `dossier_professional_assertions` AS assertion
		WHERE assertion.`dossier_id` = NEW.`dossier_id`
			AND assertion.`status` = 'accepted'
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_snapshot_assertions` AS item
				WHERE item.`dossier_id` = NEW.`dossier_id`
					AND item.`snapshot_id` = NEW.`id`
					AND item.`assertion_id` = assertion.`id`
			)
	) THEN RAISE(ABORT, 'snapshot assertion manifest must equal all current accepted assertions') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_snapshot_anchors` AS item
		LEFT JOIN `dossier_source_anchors` AS anchor
			ON anchor.`dossier_id` = item.`dossier_id` AND anchor.`id` = item.`source_anchor_id`
		WHERE item.`dossier_id` = NEW.`dossier_id` AND item.`snapshot_id` = NEW.`id`
			AND (anchor.`id` IS NULL OR anchor.`review_state` <> 'accepted')
	) OR EXISTS (
		SELECT 1 FROM `dossier_source_anchors` AS anchor
		WHERE anchor.`dossier_id` = NEW.`dossier_id`
			AND anchor.`review_state` = 'accepted'
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_snapshot_anchors` AS item
				WHERE item.`dossier_id` = NEW.`dossier_id`
					AND item.`snapshot_id` = NEW.`id`
					AND item.`source_anchor_id` = anchor.`id`
			)
	) THEN RAISE(ABORT, 'snapshot anchor manifest must equal all current accepted anchors') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_snapshot_decision_packages` AS item
		LEFT JOIN `dossier_decision_package_references` AS package
			ON package.`dossier_id` = item.`dossier_id`
			AND package.`id` = item.`decision_package_reference_id`
		WHERE item.`dossier_id` = NEW.`dossier_id` AND item.`snapshot_id` = NEW.`id`
			AND (package.`id` IS NULL
				OR package.`state` <> 'current'
				OR package.`package_id` <> item.`package_id`
				OR package.`package_version` <> item.`package_version`
				OR package.`graph_digest` <> item.`graph_digest`)
	) OR EXISTS (
		SELECT 1 FROM `dossier_decision_package_references` AS package
		WHERE package.`dossier_id` = NEW.`dossier_id`
			AND package.`state` = 'current'
			AND NOT EXISTS (
				SELECT 1 FROM `dossier_snapshot_decision_packages` AS item
				WHERE item.`dossier_id` = NEW.`dossier_id`
					AND item.`snapshot_id` = NEW.`id`
					AND item.`decision_package_reference_id` = package.`id`
					AND item.`package_id` = package.`package_id`
					AND item.`package_version` = package.`package_version`
					AND item.`graph_digest` = package.`graph_digest`
			)
	) THEN RAISE(ABORT, 'snapshot package manifest must equal all current exact governed package references') END;
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_documents_insert_guard`
BEFORE INSERT ON `dossier_snapshot_document_versions`
FOR EACH ROW
WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`snapshot_id`) <> false
BEGIN
	SELECT RAISE(ABORT, 'sealed snapshot manifest cannot change');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_assertions_insert_guard`
BEFORE INSERT ON `dossier_snapshot_assertions`
FOR EACH ROW
WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`snapshot_id`) <> false
	OR (SELECT `status` FROM `dossier_professional_assertions` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`assertion_id`) <> 'accepted'
BEGIN
	SELECT RAISE(ABORT, 'snapshot assertions must be accepted before sealing');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_anchors_insert_guard`
BEFORE INSERT ON `dossier_snapshot_anchors`
FOR EACH ROW
WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`snapshot_id`) <> false
	OR (SELECT `review_state` FROM `dossier_source_anchors` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`source_anchor_id`) <> 'accepted'
BEGIN
	SELECT RAISE(ABORT, 'snapshot anchors must be accepted before sealing');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_packages_insert_guard`
BEFORE INSERT ON `dossier_snapshot_decision_packages`
FOR EACH ROW
WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`snapshot_id`) <> false
	OR NOT EXISTS (
		SELECT 1 FROM `dossier_decision_package_references`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `id` = NEW.`decision_package_reference_id`
			AND `package_id` = NEW.`package_id`
			AND `package_version` = NEW.`package_version`
			AND `graph_digest` = NEW.`graph_digest`
			AND `state` = 'current'
	)
BEGIN
	SELECT RAISE(ABORT, 'sealed snapshot manifest cannot change');
END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_documents_update_guard` BEFORE UPDATE ON `dossier_snapshot_document_versions` BEGIN SELECT RAISE(ABORT, 'snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_documents_delete_guard` BEFORE DELETE ON `dossier_snapshot_document_versions` FOR EACH ROW WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`snapshot_id`) <> false BEGIN SELECT RAISE(ABORT, 'sealed snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_assertions_update_guard` BEFORE UPDATE ON `dossier_snapshot_assertions` BEGIN SELECT RAISE(ABORT, 'snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_assertions_delete_guard` BEFORE DELETE ON `dossier_snapshot_assertions` FOR EACH ROW WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`snapshot_id`) <> false BEGIN SELECT RAISE(ABORT, 'sealed snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_anchors_update_guard` BEFORE UPDATE ON `dossier_snapshot_anchors` BEGIN SELECT RAISE(ABORT, 'snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_anchors_delete_guard` BEFORE DELETE ON `dossier_snapshot_anchors` FOR EACH ROW WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`snapshot_id`) <> false BEGIN SELECT RAISE(ABORT, 'sealed snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_packages_update_guard` BEFORE UPDATE ON `dossier_snapshot_decision_packages` BEGIN SELECT RAISE(ABORT, 'snapshot manifest rows are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `dossier_snapshot_packages_delete_guard` BEFORE DELETE ON `dossier_snapshot_decision_packages` FOR EACH ROW WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`snapshot_id`) <> false BEGIN SELECT RAISE(ABORT, 'sealed snapshot manifest rows are immutable'); END;
