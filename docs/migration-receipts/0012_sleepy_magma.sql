CREATE TABLE `dossier_ai_proposal_anchors` (
	`dossier_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`proposal_id`) REFERENCES `dossier_ai_proposals`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_anchors_uidx` ON `dossier_ai_proposal_anchors` (`dossier_id`,`proposal_id`,`source_anchor_id`);--> statement-breakpoint
CREATE TABLE `dossier_ai_proposal_versions` (
	`dossier_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`proposal_id`) REFERENCES `dossier_ai_proposals`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_versions_uidx` ON `dossier_ai_proposal_versions` (`dossier_id`,`proposal_id`,`document_version_id`);--> statement-breakpoint
CREATE TABLE `dossier_ai_proposal_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`expected_dossier_revision` integer NOT NULL,
	`requested_by_user_id` integer NOT NULL,
	`requested_by_actor_ref` text NOT NULL,
	`idempotency_key_hash` text NOT NULL,
	`request_digest` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`model_provider` text NOT NULL,
	`model_name` text NOT NULL,
	`model_configuration_digest` text NOT NULL,
	`lease_owner` text,
	`lease_expires_at` text,
	`provider_receipt_digest` text,
	`error_code` text,
	`error_detail_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by_user_id`,`requested_by_actor_ref`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_ai_proposal_jobs_revision_check" CHECK("dossier_ai_proposal_jobs"."expected_dossier_revision" >= 1),
	CONSTRAINT "dossier_ai_proposal_jobs_status_check" CHECK("dossier_ai_proposal_jobs"."status" in ('queued','processing','ready','failed')),
	CONSTRAINT "dossier_ai_proposal_jobs_attempt_check" CHECK("dossier_ai_proposal_jobs"."attempt" between 1 and 5),
	CONSTRAINT "dossier_ai_proposal_jobs_model_check" CHECK(length(trim("dossier_ai_proposal_jobs"."model_provider")) between 1 and 120 and length(trim("dossier_ai_proposal_jobs"."model_name")) between 1 and 200),
	CONSTRAINT "dossier_ai_proposal_jobs_idempotency_hash_check" CHECK(length("dossier_ai_proposal_jobs"."idempotency_key_hash") = 71 and substr("dossier_ai_proposal_jobs"."idempotency_key_hash", 1, 7) = 'sha256-' and substr("dossier_ai_proposal_jobs"."idempotency_key_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_ai_proposal_jobs_request_digest_check" CHECK(length("dossier_ai_proposal_jobs"."request_digest") = 71 and substr("dossier_ai_proposal_jobs"."request_digest", 1, 7) = 'sha256-' and substr("dossier_ai_proposal_jobs"."request_digest", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_ai_proposal_jobs_configuration_digest_check" CHECK(length("dossier_ai_proposal_jobs"."model_configuration_digest") = 71 and substr("dossier_ai_proposal_jobs"."model_configuration_digest", 1, 7) = 'sha256-' and substr("dossier_ai_proposal_jobs"."model_configuration_digest", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_ai_proposal_jobs_provider_receipt_check" CHECK("dossier_ai_proposal_jobs"."provider_receipt_digest" is null or (length("dossier_ai_proposal_jobs"."provider_receipt_digest") = 71 and substr("dossier_ai_proposal_jobs"."provider_receipt_digest", 1, 7) = 'sha256-' and substr("dossier_ai_proposal_jobs"."provider_receipt_digest", 8) not glob '*[^0-9a-f]*')),
	CONSTRAINT "dossier_ai_proposal_jobs_lease_pair_check" CHECK(("dossier_ai_proposal_jobs"."lease_owner" is null) = ("dossier_ai_proposal_jobs"."lease_expires_at" is null)),
	CONSTRAINT "dossier_ai_proposal_jobs_lease_owner_check" CHECK("dossier_ai_proposal_jobs"."lease_owner" is null or length("dossier_ai_proposal_jobs"."lease_owner") between 1 and 200),
	CONSTRAINT "dossier_ai_proposal_jobs_error_check" CHECK("dossier_ai_proposal_jobs"."error_code" is null or "dossier_ai_proposal_jobs"."error_code" in ('rate_limited','provider_unavailable','invalid_response','safety_rejected','timeout','internal_error')),
	CONSTRAINT "dossier_ai_proposal_jobs_error_detail_check" CHECK("dossier_ai_proposal_jobs"."error_detail_code" is null or (length("dossier_ai_proposal_jobs"."error_detail_code") between 1 and 120 and "dossier_ai_proposal_jobs"."error_detail_code" not glob '*[^a-z0-9_]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_jobs_scope_uidx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_jobs_idempotency_uidx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`requested_by_actor_ref`,`idempotency_key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_jobs_request_uidx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`expected_dossier_revision`,`request_digest`);--> statement-breakpoint
CREATE INDEX `dossier_ai_proposal_jobs_status_lease_idx` ON `dossier_ai_proposal_jobs` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `dossier_ai_proposal_jobs_dossier_created_idx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_ai_proposal_job_sources` (
	`dossier_id` text NOT NULL,
	`job_id` text NOT NULL,
	`job_attempt` integer NOT NULL,
	`lease_owner` text NOT NULL,
	`source_ordinal` integer NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`extraction_result_id` text NOT NULL,
	`context_start` integer NOT NULL,
	`context_end` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`job_id`) REFERENCES `dossier_ai_proposal_jobs`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`extraction_result_id`) REFERENCES `dossier_extraction_results`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_ai_proposal_job_sources_ordinal_check" CHECK("dossier_ai_proposal_job_sources"."source_ordinal" between 1 and 8),
	CONSTRAINT "dossier_ai_proposal_job_sources_fence_check" CHECK("dossier_ai_proposal_job_sources"."job_attempt" between 1 and 5 and length("dossier_ai_proposal_job_sources"."lease_owner") between 1 and 200),
	CONSTRAINT "dossier_ai_proposal_job_sources_range_check" CHECK("dossier_ai_proposal_job_sources"."context_start" >= 0 and "dossier_ai_proposal_job_sources"."context_end" > "dossier_ai_proposal_job_sources"."context_start" and "dossier_ai_proposal_job_sources"."context_end" - "dossier_ai_proposal_job_sources"."context_start" <= 24000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_job_sources_version_uidx` ON `dossier_ai_proposal_job_sources` (`dossier_id`,`job_id`,`document_version_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_job_sources_ordinal_uidx` ON `dossier_ai_proposal_job_sources` (`dossier_id`,`job_id`,`source_ordinal`);--> statement-breakpoint
CREATE INDEX `dossier_ai_proposal_job_sources_result_idx` ON `dossier_ai_proposal_job_sources` (`dossier_id`,`extraction_result_id`,`job_id`);--> statement-breakpoint
CREATE TABLE `dossier_ai_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`generation_job_id` text,
	`proposal_type` text NOT NULL,
	`proposed_value` text NOT NULL,
	`confidence_category` text,
	`confidence_score` real,
	`model_provider` text,
	`model_name` text,
	`model_configuration_digest` text,
	`review_state` text DEFAULT 'pending' NOT NULL,
	`reviewing_user_id` integer,
	`reviewing_actor_ref` text,
	`reviewed_at` text,
	`review_note` text,
	`accepted_object_type` text,
	`accepted_object_id` text,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewing_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`generation_job_id`) REFERENCES `dossier_ai_proposal_jobs`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewing_user_id`,`reviewing_actor_ref`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_ai_proposals_type_check" CHECK("dossier_ai_proposals"."proposal_type" in ('document_metadata','participant','dated_event','deadline','fact','authority_rule','contradiction','information_request','evidence_link','graph_change','assumption','dossier_summary')),
	CONSTRAINT "dossier_ai_proposals_confidence_check" CHECK("dossier_ai_proposals"."confidence_category" is null or "dossier_ai_proposals"."confidence_category" in ('low','medium','high')),
	CONSTRAINT "dossier_ai_proposals_score_check" CHECK("dossier_ai_proposals"."confidence_score" is null or "dossier_ai_proposals"."confidence_score" between 0 and 1),
	CONSTRAINT "dossier_ai_proposals_review_check" CHECK("dossier_ai_proposals"."review_state" in ('pending','accepted','rejected','superseded')),
	CONSTRAINT "dossier_ai_proposals_accepted_type_check" CHECK("dossier_ai_proposals"."accepted_object_type" is null or "dossier_ai_proposals"."accepted_object_type" in ('participant','document','professional_assertion','evidence_link','information_request','deadline_reference','decision_package_reference')),
	CONSTRAINT "dossier_ai_proposals_accepted_pair_check" CHECK(("dossier_ai_proposals"."accepted_object_type" is null) = ("dossier_ai_proposals"."accepted_object_id" is null)),
	CONSTRAINT "dossier_ai_proposals_model_receipt_check" CHECK(("dossier_ai_proposals"."model_provider" is null and "dossier_ai_proposals"."model_name" is null and "dossier_ai_proposals"."model_configuration_digest" is null) or ("dossier_ai_proposals"."model_provider" is not null and "dossier_ai_proposals"."model_name" is not null and length("dossier_ai_proposals"."model_configuration_digest") = 71 and substr("dossier_ai_proposals"."model_configuration_digest", 1, 7) = 'sha256-' and substr("dossier_ai_proposals"."model_configuration_digest", 8) not glob '*[^0-9a-f]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposals_scope_uidx` ON `dossier_ai_proposals` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_ai_proposals_review_created_idx` ON `dossier_ai_proposals` (`dossier_id`,`review_state`,`created_at`);--> statement-breakpoint
CREATE INDEX `dossier_ai_proposals_job_created_idx` ON `dossier_ai_proposals` (`dossier_id`,`generation_job_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_assertion_sources` (
	`dossier_id` text NOT NULL,
	`assertion_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`assertion_id`) REFERENCES `dossier_professional_assertions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_assertion_sources_uidx` ON `dossier_assertion_sources` (`dossier_id`,`assertion_id`,`source_anchor_id`);--> statement-breakpoint
CREATE INDEX `dossier_assertion_sources_anchor_idx` ON `dossier_assertion_sources` (`dossier_id`,`source_anchor_id`,`assertion_id`);--> statement-breakpoint
CREATE TABLE `dossier_revision_receipts` (
	`dossier_id` text NOT NULL,
	`resulting_revision` integer NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_revision_receipts_revision_check" CHECK("dossier_revision_receipts"."resulting_revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_revision_receipts_revision_uidx` ON `dossier_revision_receipts` (`dossier_id`,`resulting_revision`);--> statement-breakpoint
CREATE INDEX `dossier_revision_receipts_created_idx` ON `dossier_revision_receipts` (`dossier_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`dossier_revision` integer NOT NULL,
	`sequence` integer NOT NULL,
	`event_type` text NOT NULL,
	`object_ref_type` text NOT NULL,
	`object_ref_id` text NOT NULL,
	`actor_user_id` integer,
	`actor_ref` text NOT NULL,
	`actor_role` text NOT NULL,
	`occurred_at` text NOT NULL,
	`summary_code` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`previous_event_id` text,
	`event_digest` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`dossier_revision`) REFERENCES `dossier_revision_receipts`(`dossier_id`,`resulting_revision`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY (`dossier_id`,`previous_event_id`) REFERENCES `dossier_audit_events`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_audit_events_sequence_check" CHECK("dossier_audit_events"."sequence" >= 1 and (("dossier_audit_events"."sequence" = 1 and "dossier_audit_events"."previous_event_id" is null) or ("dossier_audit_events"."sequence" > 1 and "dossier_audit_events"."previous_event_id" is not null))),
	CONSTRAINT "dossier_audit_events_revision_check" CHECK("dossier_audit_events"."dossier_revision" >= 1),
	CONSTRAINT "dossier_audit_events_type_check" CHECK("dossier_audit_events"."event_type" in ('dossier_created','dossier_updated','dossier_status_transitioned','participant_changed','document_created','document_version_created','source_anchor_reviewed','assertion_reviewed','evidence_link_changed','information_request_changed','proposal_reviewed','proposal_generation_completed','decision_package_linked','snapshot_created','output_generated','output_approved','output_marked_stale','legacy_case_migration_requested','admin_archive_override')),
	CONSTRAINT "dossier_audit_events_object_type_check" CHECK("dossier_audit_events"."object_ref_type" in ('dossier','participant','status_transition','document','document_version','source_anchor','professional_assertion','evidence_link','information_request','deadline_reference','decision_package_reference','ai_proposal','dossier_snapshot','governed_output','audit_event')),
	CONSTRAINT "dossier_audit_events_role_check" CHECK("dossier_audit_events"."actor_role" in ('owner','contributor','reviewer','viewer','platform_admin','system','import')),
	CONSTRAINT "dossier_audit_events_digest_check" CHECK(length("dossier_audit_events"."event_digest") = 71 and substr("dossier_audit_events"."event_digest", 1, 7) = 'sha256-' and substr("dossier_audit_events"."event_digest", 8) not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_events_scope_uidx` ON `dossier_audit_events` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_events_sequence_uidx` ON `dossier_audit_events` (`dossier_id`,`sequence`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_events_digest_uidx` ON `dossier_audit_events` (`dossier_id`,`event_digest`);--> statement-breakpoint
CREATE INDEX `dossier_audit_events_object_occurred_idx` ON `dossier_audit_events` (`dossier_id`,`object_ref_type`,`object_ref_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `dossier_audit_events_occurred_idx` ON `dossier_audit_events` (`dossier_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `dossier_deadline_references` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`deadline_kind` text NOT NULL,
	`title` text NOT NULL,
	`due_at` text NOT NULL,
	`timezone` text NOT NULL,
	`critical` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`decision_package_reference_id` text,
	`simulation_deadline_id` text,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`decision_package_reference_id`) REFERENCES `dossier_decision_package_references`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_deadline_references_kind_check" CHECK("dossier_deadline_references"."deadline_kind" in ('workspace','projected_simulation')),
	CONSTRAINT "dossier_deadline_references_status_check" CHECK("dossier_deadline_references"."status" in ('open','completed','waived','cancelled')),
	CONSTRAINT "dossier_deadline_references_projection_check" CHECK(("dossier_deadline_references"."deadline_kind" = 'workspace' and "dossier_deadline_references"."decision_package_reference_id" is null and "dossier_deadline_references"."simulation_deadline_id" is null) or ("dossier_deadline_references"."deadline_kind" = 'projected_simulation' and "dossier_deadline_references"."decision_package_reference_id" is not null and "dossier_deadline_references"."simulation_deadline_id" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_deadline_references_scope_uidx` ON `dossier_deadline_references` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_deadline_references_status_due_idx` ON `dossier_deadline_references` (`dossier_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `dossier_deadline_sources` (
	`dossier_id` text NOT NULL,
	`deadline_reference_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`deadline_reference_id`) REFERENCES `dossier_deadline_references`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_deadline_sources_uidx` ON `dossier_deadline_sources` (`dossier_id`,`deadline_reference_id`,`source_anchor_id`);--> statement-breakpoint
CREATE INDEX `dossier_deadline_sources_anchor_idx` ON `dossier_deadline_sources` (`dossier_id`,`source_anchor_id`);--> statement-breakpoint
CREATE TABLE `dossier_decision_package_references` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`package_id` text NOT NULL,
	`package_version` text NOT NULL,
	`package_fingerprint` text NOT NULL,
	`parent_package_id` text,
	`parent_package_version` text,
	`parent_package_fingerprint` text,
	`source_snapshot_id` text,
	`source_dossier_revision` integer NOT NULL,
	`state` text DEFAULT 'current' NOT NULL,
	`graph_validation_status` text DEFAULT 'not_run' NOT NULL,
	`graph_digest` text NOT NULL,
	`simulation_run_references` text DEFAULT '[]' NOT NULL,
	`approval_state` text DEFAULT 'draft' NOT NULL,
	`package_type_registry` text NOT NULL,
	`package_type_id` text NOT NULL,
	`package_type_version` text NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_decision_packages_revision_check" CHECK("dossier_decision_package_references"."source_dossier_revision" >= 1),
	CONSTRAINT "dossier_decision_packages_state_check" CHECK("dossier_decision_package_references"."state" in ('current','stale')),
	CONSTRAINT "dossier_decision_packages_graph_status_check" CHECK("dossier_decision_package_references"."graph_validation_status" in ('not_run','valid','invalid')),
	CONSTRAINT "dossier_decision_packages_approval_check" CHECK("dossier_decision_package_references"."approval_state" in ('draft','reviewed','approved','published')),
	CONSTRAINT "dossier_decision_packages_fingerprint_check" CHECK(length("dossier_decision_package_references"."package_fingerprint") = 71 and substr("dossier_decision_package_references"."package_fingerprint", 1, 7) = 'sha256-' and substr("dossier_decision_package_references"."package_fingerprint", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_decision_packages_parent_fingerprint_check" CHECK("dossier_decision_package_references"."parent_package_fingerprint" is null or (length("dossier_decision_package_references"."parent_package_fingerprint") = 71 and substr("dossier_decision_package_references"."parent_package_fingerprint", 1, 7) = 'sha256-' and substr("dossier_decision_package_references"."parent_package_fingerprint", 8) not glob '*[^0-9a-f]*')),
	CONSTRAINT "dossier_decision_packages_parent_tuple_check" CHECK(("dossier_decision_package_references"."parent_package_id" is null and "dossier_decision_package_references"."parent_package_version" is null and "dossier_decision_package_references"."parent_package_fingerprint" is null) or ("dossier_decision_package_references"."parent_package_id" is not null and "dossier_decision_package_references"."parent_package_version" is not null and "dossier_decision_package_references"."parent_package_fingerprint" is not null)),
	CONSTRAINT "dossier_decision_packages_graph_digest_check" CHECK(length("dossier_decision_package_references"."graph_digest") = 71 and substr("dossier_decision_package_references"."graph_digest", 1, 7) = 'sha256-' and substr("dossier_decision_package_references"."graph_digest", 8) not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_decision_packages_scope_uidx` ON `dossier_decision_package_references` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_decision_packages_version_uidx` ON `dossier_decision_package_references` (`dossier_id`,`package_id`,`package_version`,`package_fingerprint`);--> statement-breakpoint
CREATE INDEX `dossier_decision_packages_state_updated_idx` ON `dossier_decision_package_references` (`dossier_id`,`state`,`updated_at`);--> statement-breakpoint
CREATE TABLE `dossier_document_current_versions` (
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`) REFERENCES `dossier_documents`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_current_versions_document_uidx` ON `dossier_document_current_versions` (`dossier_id`,`document_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_current_versions_version_uidx` ON `dossier_document_current_versions` (`dossier_id`,`document_id`,`document_version_id`);--> statement-breakpoint
CREATE TABLE `dossier_document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`binary_object_reference` text NOT NULL,
	`original_filename` text NOT NULL,
	`media_type` text NOT NULL,
	`byte_length` integer NOT NULL,
	`content_sha256` text NOT NULL,
	`uploader_user_id` integer,
	`uploader_actor_ref` text NOT NULL,
	`upload_intent_id` text,
	`uploaded_at` text NOT NULL,
	`predecessor_version_id` text,
	`source_note` text,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploader_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`document_id`) REFERENCES `dossier_documents`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`predecessor_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`upload_intent_id`) REFERENCES `dossier_upload_intents`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_document_versions_ordinal_check" CHECK("dossier_document_versions"."ordinal" >= 1),
	CONSTRAINT "dossier_document_versions_media_check" CHECK("dossier_document_versions"."media_type" in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown')),
	CONSTRAINT "dossier_document_versions_size_check" CHECK("dossier_document_versions"."byte_length" between 1 and 100000000),
	CONSTRAINT "dossier_document_versions_hash_check" CHECK(length("dossier_document_versions"."content_sha256") = 71 and substr("dossier_document_versions"."content_sha256", 1, 7) = 'sha256-' and substr("dossier_document_versions"."content_sha256", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_document_versions_predecessor_check" CHECK(("dossier_document_versions"."ordinal" = 1 and "dossier_document_versions"."predecessor_version_id" is null) or ("dossier_document_versions"."ordinal" > 1 and "dossier_document_versions"."predecessor_version_id" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_scope_uidx` ON `dossier_document_versions` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_document_scope_uidx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_snapshot_binding_uidx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`id`,`content_sha256`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_ordinal_uidx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`ordinal`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_object_uidx` ON `dossier_document_versions` (`binary_object_reference`);--> statement-breakpoint
CREATE INDEX `dossier_document_versions_document_uploaded_idx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `dossier_document_versions_hash_idx` ON `dossier_document_versions` (`content_sha256`);--> statement-breakpoint
CREATE TABLE `dossier_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`title` text NOT NULL,
	`document_type` text NOT NULL,
	`source_origin` text NOT NULL,
	`is_provisional` integer DEFAULT true NOT NULL,
	`classification` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`external_system_reference` text,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_documents_origin_check" CHECK("dossier_documents"."source_origin" in ('internal_upload','external_reference','import')),
	CONSTRAINT "dossier_documents_provisional_check" CHECK("dossier_documents"."is_provisional" in (false, true)),
	CONSTRAINT "dossier_documents_classification_check" CHECK("dossier_documents"."classification" in ('public','internal','confidential','strictly_confidential')),
	CONSTRAINT "dossier_documents_status_check" CHECK("dossier_documents"."status" in ('received','under_review','accepted_source','superseded','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_documents_scope_uidx` ON `dossier_documents` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_documents_dossier_status_updated_idx` ON `dossier_documents` (`dossier_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `dossier_documents_provisional_created_idx` ON `dossier_documents` (`dossier_id`,`is_provisional`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_evidence_links` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	`assertion_id` text,
	`decision_package_reference_id` text,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`relation` text NOT NULL,
	`professional_meaning` text NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`reviewed_by_user_id` integer NOT NULL,
	`reviewed_by_actor_ref` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`assertion_id`) REFERENCES `dossier_professional_assertions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`decision_package_reference_id`) REFERENCES `dossier_decision_package_references`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`,`reviewed_by_actor_ref`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_evidence_links_target_check" CHECK("dossier_evidence_links"."target_type" in ('professional_assertion','authority_rule','graph_node','graph_edge','parameter_assumption','deadline','report_section')),
	CONSTRAINT "dossier_evidence_links_graph_package_check" CHECK((("dossier_evidence_links"."target_type" in ('graph_node','graph_edge')) and "dossier_evidence_links"."decision_package_reference_id" is not null) or (("dossier_evidence_links"."target_type" not in ('graph_node','graph_edge')) and "dossier_evidence_links"."decision_package_reference_id" is null)),
	CONSTRAINT "dossier_evidence_links_relation_check" CHECK("dossier_evidence_links"."relation" in ('supports','contradicts','qualifies','supersedes','source_for'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_evidence_links_scope_uidx` ON `dossier_evidence_links` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_evidence_links_target_idx` ON `dossier_evidence_links` (`dossier_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `dossier_evidence_links_package_target_idx` ON `dossier_evidence_links` (`dossier_id`,`decision_package_reference_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `dossier_evidence_links_anchor_idx` ON `dossier_evidence_links` (`dossier_id`,`source_anchor_id`);--> statement-breakpoint
CREATE TABLE `dossier_extraction_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`extractor_version` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`lease_owner` text,
	`lease_expires_at` text,
	`error_code` text,
	`error_detail_code` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_extraction_jobs_status_check" CHECK("dossier_extraction_jobs"."status" in ('queued','processing','ready','failed','not_extractable')),
	CONSTRAINT "dossier_extraction_jobs_attempt_check" CHECK("dossier_extraction_jobs"."attempt" >= 1 and "dossier_extraction_jobs"."attempt" <= 10),
	CONSTRAINT "dossier_extraction_jobs_error_check" CHECK("dossier_extraction_jobs"."error_code" is null or "dossier_extraction_jobs"."error_code" in ('unsupported_type','image_only','active_content','malformed','size_limit','internal_error')),
	CONSTRAINT "dossier_extraction_jobs_lease_pair_check" CHECK(("dossier_extraction_jobs"."lease_owner" is null) = ("dossier_extraction_jobs"."lease_expires_at" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_jobs_scope_uidx` ON `dossier_extraction_jobs` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_jobs_attempt_uidx` ON `dossier_extraction_jobs` (`dossier_id`,`document_version_id`,`extractor_version`,`attempt`);--> statement-breakpoint
CREATE INDEX `dossier_extraction_jobs_status_lease_idx` ON `dossier_extraction_jobs` (`status`,`lease_expires_at`);--> statement-breakpoint
CREATE INDEX `dossier_extraction_jobs_version_created_idx` ON `dossier_extraction_jobs` (`dossier_id`,`document_version_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_extraction_page_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`extraction_result_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`section_id` text,
	`heading` text,
	`start_offset` integer NOT NULL,
	`end_offset` integer NOT NULL,
	`checksum` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`extraction_result_id`) REFERENCES `dossier_extraction_results`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_extraction_page_maps_page_check" CHECK("dossier_extraction_page_maps"."page_number" >= 1),
	CONSTRAINT "dossier_extraction_page_maps_offsets_check" CHECK("dossier_extraction_page_maps"."start_offset" >= 0 and "dossier_extraction_page_maps"."end_offset" >= "dossier_extraction_page_maps"."start_offset"),
	CONSTRAINT "dossier_extraction_page_maps_checksum_check" CHECK(length("dossier_extraction_page_maps"."checksum") = 71 and substr("dossier_extraction_page_maps"."checksum", 1, 7) = 'sha256-' and substr("dossier_extraction_page_maps"."checksum", 8) not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_page_maps_scope_uidx` ON `dossier_extraction_page_maps` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_page_maps_range_uidx` ON `dossier_extraction_page_maps` (`dossier_id`,`extraction_result_id`,`page_number`,`start_offset`,`end_offset`);--> statement-breakpoint
CREATE INDEX `dossier_extraction_page_maps_version_page_idx` ON `dossier_extraction_page_maps` (`dossier_id`,`document_version_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `dossier_extraction_results` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`extraction_job_id` text NOT NULL,
	`extractor_version` text NOT NULL,
	`extracted_text_object_reference` text NOT NULL,
	`extracted_text_sha256` text NOT NULL,
	`extracted_text_byte_length` integer NOT NULL,
	`character_count` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`extraction_job_id`) REFERENCES `dossier_extraction_jobs`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_extraction_results_hash_check" CHECK(length("dossier_extraction_results"."extracted_text_sha256") = 71 and substr("dossier_extraction_results"."extracted_text_sha256", 1, 7) = 'sha256-' and substr("dossier_extraction_results"."extracted_text_sha256", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_extraction_results_bounds_check" CHECK("dossier_extraction_results"."extracted_text_byte_length" between 0 and 100000000 and "dossier_extraction_results"."character_count" between 0 and 100000000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_scope_uidx` ON `dossier_extraction_results` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_version_extractor_uidx` ON `dossier_extraction_results` (`dossier_id`,`document_version_id`,`extractor_version`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_job_uidx` ON `dossier_extraction_results` (`dossier_id`,`extraction_job_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_object_uidx` ON `dossier_extraction_results` (`extracted_text_object_reference`);--> statement-breakpoint
CREATE INDEX `dossier_extraction_results_version_created_idx` ON `dossier_extraction_results` (`dossier_id`,`document_version_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_governed_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`snapshot_digest` text NOT NULL,
	`format` text NOT NULL,
	`content_reference` text NOT NULL,
	`content_sha256` text NOT NULL,
	`filename` text NOT NULL,
	`generator_schema_version` integer NOT NULL,
	`generator_build_version` text NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_governed_outputs_snapshot_digest_check" CHECK(length("dossier_governed_outputs"."snapshot_digest") = 71 and substr("dossier_governed_outputs"."snapshot_digest", 1, 7) = 'sha256-' and substr("dossier_governed_outputs"."snapshot_digest", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_governed_outputs_format_check" CHECK("dossier_governed_outputs"."format" in ('pdf','json_manifest','markdown')),
	CONSTRAINT "dossier_governed_outputs_content_reference_check" CHECK(length("dossier_governed_outputs"."content_reference") >= 32 and instr("dossier_governed_outputs"."content_reference", '://') = 0 and instr("dossier_governed_outputs"."content_reference", '..') = 0 and instr("dossier_governed_outputs"."content_reference", char(92)) = 0),
	CONSTRAINT "dossier_governed_outputs_content_hash_check" CHECK(length("dossier_governed_outputs"."content_sha256") = 71 and substr("dossier_governed_outputs"."content_sha256", 1, 7) = 'sha256-' and substr("dossier_governed_outputs"."content_sha256", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_governed_outputs_generator_check" CHECK("dossier_governed_outputs"."generator_schema_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_governed_outputs_scope_uidx` ON `dossier_governed_outputs` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_governed_outputs_content_uidx` ON `dossier_governed_outputs` (`content_reference`);--> statement-breakpoint
CREATE INDEX `dossier_governed_outputs_snapshot_created_idx` ON `dossier_governed_outputs` (`dossier_id`,`snapshot_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_information_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`question` text NOT NULL,
	`owner_user_id` integer NOT NULL,
	`owner_actor_ref` text NOT NULL,
	`requested_from_participant_id` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`due_at` text,
	`timezone` text,
	`status` text DEFAULT 'open' NOT NULL,
	`reason` text NOT NULL,
	`readiness_reason_code` text NOT NULL,
	`satisfying_document_id` text,
	`satisfying_evidence_link_id` text,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`requested_from_participant_id`) REFERENCES `dossier_participants`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`satisfying_document_id`) REFERENCES `dossier_documents`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`satisfying_evidence_link_id`) REFERENCES `dossier_evidence_links`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`,`owner_actor_ref`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_information_requests_priority_check" CHECK("dossier_information_requests"."priority" in ('low','normal','high','urgent')),
	CONSTRAINT "dossier_information_requests_status_check" CHECK("dossier_information_requests"."status" in ('open','received','waived','cancelled')),
	CONSTRAINT "dossier_information_requests_due_pair_check" CHECK(("dossier_information_requests"."due_at" is null) = ("dossier_information_requests"."timezone" is null)),
	CONSTRAINT "dossier_information_requests_reason_code_check" CHECK("dossier_information_requests"."readiness_reason_code" in ('INFORMATION_REQUEST_OPEN','INFORMATION_REQUEST_OVERDUE')),
	CONSTRAINT "dossier_information_requests_received_check" CHECK("dossier_information_requests"."status" <> 'received' or "dossier_information_requests"."satisfying_document_id" is not null or "dossier_information_requests"."satisfying_evidence_link_id" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_information_requests_scope_uidx` ON `dossier_information_requests` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_information_requests_status_due_idx` ON `dossier_information_requests` (`dossier_id`,`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `dossier_output_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`output_id` text NOT NULL,
	`reviewer_participant_id` text NOT NULL,
	`reviewer_user_id` integer NOT NULL,
	`reviewer_actor_ref` text NOT NULL,
	`approved_at` text NOT NULL,
	`approval_digest` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`output_id`) REFERENCES `dossier_governed_outputs`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`reviewer_participant_id`) REFERENCES `dossier_participants`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`reviewer_participant_id`,`reviewer_user_id`,`reviewer_actor_ref`) REFERENCES `dossier_participants`(`dossier_id`,`id`,`user_id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_output_approvals_digest_check" CHECK(length("dossier_output_approvals"."approval_digest") = 71 and substr("dossier_output_approvals"."approval_digest", 1, 7) = 'sha256-' and substr("dossier_output_approvals"."approval_digest", 8) not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_output_approvals_scope_uidx` ON `dossier_output_approvals` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_output_approvals_reviewer_uidx` ON `dossier_output_approvals` (`dossier_id`,`output_id`,`reviewer_participant_id`);--> statement-breakpoint
CREATE INDEX `dossier_output_approvals_output_approved_idx` ON `dossier_output_approvals` (`dossier_id`,`output_id`,`approved_at`);--> statement-breakpoint
CREATE TABLE `dossier_output_state_events` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`output_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`state` text NOT NULL,
	`reason` text,
	`occurred_at` text NOT NULL,
	`actor_ref` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`output_id`) REFERENCES `dossier_governed_outputs`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_output_states_sequence_check" CHECK("dossier_output_state_events"."sequence" >= 1),
	CONSTRAINT "dossier_output_states_state_check" CHECK("dossier_output_state_events"."state" in ('current','stale')),
	CONSTRAINT "dossier_output_states_reason_check" CHECK(("dossier_output_state_events"."state" = 'current' and "dossier_output_state_events"."reason" is null) or ("dossier_output_state_events"."state" = 'stale' and "dossier_output_state_events"."reason" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_output_states_scope_uidx` ON `dossier_output_state_events` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_output_states_sequence_uidx` ON `dossier_output_state_events` (`dossier_id`,`output_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `dossier_output_states_output_occurred_idx` ON `dossier_output_state_events` (`dossier_id`,`output_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `dossier_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`actor_id` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`actor_id`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_participants_role_check" CHECK("dossier_participants"."role" in ('owner','contributor','reviewer','viewer')),
	CONSTRAINT "dossier_participants_status_check" CHECK("dossier_participants"."status" in ('active','removed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_scope_uidx` ON `dossier_participants` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_authority_uidx` ON `dossier_participants` (`dossier_id`,`id`,`user_id`,`actor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_user_uidx` ON `dossier_participants` (`dossier_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_active_owner_uidx` ON `dossier_participants` (`dossier_id`) WHERE "dossier_participants"."role" = 'owner' and "dossier_participants"."status" = 'active';--> statement-breakpoint
CREATE INDEX `dossier_participants_user_status_idx` ON `dossier_participants` (`user_id`,`status`,`dossier_id`);--> statement-breakpoint
CREATE INDEX `dossier_participants_dossier_role_idx` ON `dossier_participants` (`dossier_id`,`role`,`status`);--> statement-breakpoint
CREATE TABLE `dossier_professional_assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`assertion_type` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`originating_proposal_id` text,
	`reviewed_by_user_id` integer,
	`reviewed_by_actor_ref` text,
	`reviewed_at` text,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`originating_proposal_id`) REFERENCES `dossier_ai_proposals`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`,`reviewed_by_actor_ref`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_professional_assertions_type_check" CHECK("dossier_professional_assertions"."assertion_type" in ('fact','evidence','rule','assumption','date','contradiction')),
	CONSTRAINT "dossier_professional_assertions_status_check" CHECK("dossier_professional_assertions"."status" in ('accepted','needs_review','rejected','superseded')),
	CONSTRAINT "dossier_professional_assertions_reviewer_pair_check" CHECK(("dossier_professional_assertions"."status" <> 'needs_review') or ("dossier_professional_assertions"."reviewed_by_user_id" is null and "dossier_professional_assertions"."reviewed_by_actor_ref" is null and "dossier_professional_assertions"."reviewed_at" is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_professional_assertions_scope_uidx` ON `dossier_professional_assertions` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_professional_assertions_status_updated_idx` ON `dossier_professional_assertions` (`dossier_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `dossier_snapshot_anchors` (
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshot_anchors_uidx` ON `dossier_snapshot_anchors` (`dossier_id`,`snapshot_id`,`source_anchor_id`);--> statement-breakpoint
CREATE TABLE `dossier_snapshot_assertions` (
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`assertion_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`assertion_id`) REFERENCES `dossier_professional_assertions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshot_assertions_uidx` ON `dossier_snapshot_assertions` (`dossier_id`,`snapshot_id`,`assertion_id`);--> statement-breakpoint
CREATE TABLE `dossier_snapshot_decision_packages` (
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`decision_package_reference_id` text NOT NULL,
	`package_id` text NOT NULL,
	`package_version` text NOT NULL,
	`graph_digest` text NOT NULL,
	`simulation_receipt_ids` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`decision_package_reference_id`) REFERENCES `dossier_decision_package_references`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_snapshot_packages_graph_digest_check" CHECK(length("dossier_snapshot_decision_packages"."graph_digest") = 71 and substr("dossier_snapshot_decision_packages"."graph_digest", 1, 7) = 'sha256-' and substr("dossier_snapshot_decision_packages"."graph_digest", 8) not glob '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshot_packages_uidx` ON `dossier_snapshot_decision_packages` (`dossier_id`,`snapshot_id`,`decision_package_reference_id`);--> statement-breakpoint
CREATE TABLE `dossier_snapshot_document_versions` (
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`content_sha256` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`,`content_sha256`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`,`content_sha256`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshot_documents_uidx` ON `dossier_snapshot_document_versions` (`dossier_id`,`snapshot_id`,`document_id`);--> statement-breakpoint
CREATE INDEX `dossier_snapshot_documents_version_idx` ON `dossier_snapshot_document_versions` (`dossier_id`,`document_version_id`);--> statement-breakpoint
CREATE TABLE `dossier_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`dossier_revision` integer NOT NULL,
	`simulation_inputs` text NOT NULL,
	`deterministic_receipts` text NOT NULL,
	`status` text NOT NULL,
	`readiness` text NOT NULL,
	`approver_records` text DEFAULT '[]' NOT NULL,
	`locale` text NOT NULL,
	`audience` text NOT NULL,
	`classification` text NOT NULL,
	`redaction_profile_id` text NOT NULL,
	`contract_version` text NOT NULL,
	`report_model_schema_version` integer NOT NULL,
	`renderer_version` text NOT NULL,
	`build_version` text NOT NULL,
	`manifest_object_reference` text NOT NULL,
	`manifest_byte_length` integer NOT NULL,
	`manifest_digest` text NOT NULL,
	`sealed` integer DEFAULT false NOT NULL,
	`sealed_at` text,
	`sealed_by_actor_ref` text,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_snapshots_revision_check" CHECK("dossier_snapshots"."dossier_revision" >= 1),
	CONSTRAINT "dossier_snapshots_status_check" CHECK("dossier_snapshots"."status" in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')),
	CONSTRAINT "dossier_snapshots_audience_check" CHECK("dossier_snapshots"."audience" in ('internal','client')),
	CONSTRAINT "dossier_snapshots_classification_check" CHECK("dossier_snapshots"."classification" in ('public','internal','confidential','strictly_confidential')),
	CONSTRAINT "dossier_snapshots_manifest_object_check" CHECK(length("dossier_snapshots"."manifest_object_reference") >= 32 and instr("dossier_snapshots"."manifest_object_reference", '://') = 0 and instr("dossier_snapshots"."manifest_object_reference", '..') = 0 and instr("dossier_snapshots"."manifest_object_reference", char(92)) = 0),
	CONSTRAINT "dossier_snapshots_manifest_length_check" CHECK("dossier_snapshots"."manifest_byte_length" between 1 and 100000000),
	CONSTRAINT "dossier_snapshots_manifest_check" CHECK(length("dossier_snapshots"."manifest_digest") = 71 and substr("dossier_snapshots"."manifest_digest", 1, 7) = 'sha256-' and substr("dossier_snapshots"."manifest_digest", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_snapshots_generator_check" CHECK("dossier_snapshots"."report_model_schema_version" >= 1),
	CONSTRAINT "dossier_snapshots_seal_check" CHECK(("dossier_snapshots"."sealed" = false and "dossier_snapshots"."sealed_at" is null and "dossier_snapshots"."sealed_by_actor_ref" is null) or ("dossier_snapshots"."sealed" = true and "dossier_snapshots"."sealed_at" is not null and "dossier_snapshots"."sealed_by_actor_ref" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshots_scope_uidx` ON `dossier_snapshots` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshots_manifest_uidx` ON `dossier_snapshots` (`dossier_id`,`manifest_digest`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshots_manifest_object_uidx` ON `dossier_snapshots` (`manifest_object_reference`);--> statement-breakpoint
CREATE INDEX `dossier_snapshots_revision_created_idx` ON `dossier_snapshots` (`dossier_id`,`dossier_revision`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_source_anchors` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`document_version_id` text NOT NULL,
	`page_number` integer,
	`section` text,
	`heading` text,
	`paragraph` text,
	`character_start` integer,
	`character_end` integer,
	`excerpt` text,
	`anchor_checksum` text NOT NULL,
	`extraction_version` text,
	`creator` text NOT NULL,
	`review_state` text DEFAULT 'pending' NOT NULL,
	`reviewer_user_id` integer,
	`reviewer_actor_ref` text,
	`reviewed_at` text,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`document_id`,`document_version_id`) REFERENCES `dossier_document_versions`(`dossier_id`,`document_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`document_version_id`,`extraction_version`) REFERENCES `dossier_extraction_results`(`dossier_id`,`document_version_id`,`extractor_version`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_user_id`,`reviewer_actor_ref`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_source_anchors_page_check" CHECK("dossier_source_anchors"."page_number" is null or "dossier_source_anchors"."page_number" >= 1),
	CONSTRAINT "dossier_source_anchors_character_pair_check" CHECK(("dossier_source_anchors"."character_start" is null and "dossier_source_anchors"."character_end" is null) or ("dossier_source_anchors"."character_start" >= 0 and "dossier_source_anchors"."character_end" >= "dossier_source_anchors"."character_start")),
	CONSTRAINT "dossier_source_anchors_checksum_check" CHECK(length("dossier_source_anchors"."anchor_checksum") = 71 and substr("dossier_source_anchors"."anchor_checksum", 1, 7) = 'sha256-' and substr("dossier_source_anchors"."anchor_checksum", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_source_anchors_creator_check" CHECK("dossier_source_anchors"."creator" in ('human','ai_proposal','import')),
	CONSTRAINT "dossier_source_anchors_review_check" CHECK("dossier_source_anchors"."review_state" in ('pending','accepted','rejected','superseded')),
	CONSTRAINT "dossier_source_anchors_reviewer_pair_check" CHECK((("dossier_source_anchors"."review_state" in ('accepted','rejected')) = ("dossier_source_anchors"."reviewer_user_id" is not null and "dossier_source_anchors"."reviewer_actor_ref" is not null and "dossier_source_anchors"."reviewed_at" is not null)))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_source_anchors_scope_uidx` ON `dossier_source_anchors` (`dossier_id`,`id`);--> statement-breakpoint
CREATE INDEX `dossier_source_anchors_version_review_idx` ON `dossier_source_anchors` (`dossier_id`,`document_version_id`,`review_state`);--> statement-breakpoint
CREATE INDEX `dossier_source_anchors_dossier_created_idx` ON `dossier_source_anchors` (`dossier_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossier_status_transitions` (
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
	FOREIGN KEY (`dossier_id`,`revision_after`,`new_status`) REFERENCES `dossiers`(`id`,`revision`,`status`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossier_status_transitions_revision_check" CHECK("dossier_status_transitions"."revision_before" >= 1 and "dossier_status_transitions"."revision_after" = "dossier_status_transitions"."revision_before" + 1),
	CONSTRAINT "dossier_status_transitions_previous_check" CHECK("dossier_status_transitions"."previous_status" in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')),
	CONSTRAINT "dossier_status_transitions_new_check" CHECK("dossier_status_transitions"."new_status" in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')),
	CONSTRAINT "dossier_status_transitions_approved_output_check" CHECK(("dossier_status_transitions"."new_status" = 'output_approved') = ("dossier_status_transitions"."approved_output_id" is not null)),
	CONSTRAINT "dossier_status_transitions_role_check" CHECK("dossier_status_transitions"."actor_role" in ('owner','contributor','reviewer','viewer','platform_admin'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_transitions_scope_uidx` ON `dossier_status_transitions` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_transitions_revision_uidx` ON `dossier_status_transitions` (`dossier_id`,`revision_after`);--> statement-breakpoint
CREATE INDEX `dossier_status_transitions_dossier_occurred_idx` ON `dossier_status_transitions` (`dossier_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `dossier_status_transitions_approved_output_idx` ON `dossier_status_transitions` (`dossier_id`,`approved_output_id`,`revision_after`);--> statement-breakpoint
CREATE TABLE `dossier_upload_intents` (
	`id` text PRIMARY KEY NOT NULL,
	`dossier_id` text NOT NULL,
	`document_id` text NOT NULL,
	`actor_user_id` integer,
	`actor_ref` text NOT NULL,
	`idempotency_key_hash` text NOT NULL,
	`request_binding_digest` text NOT NULL,
	`expected_dossier_revision` integer NOT NULL,
	`temporary_object_reference` text NOT NULL,
	`committed_object_reference` text,
	`expected_media_type` text NOT NULL,
	`expected_byte_length` integer NOT NULL,
	`expected_content_sha256` text,
	`measured_media_type` text,
	`measured_byte_length` integer,
	`measured_content_sha256` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`failure_code` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`committed_at` text,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`dossier_id`,`document_id`) REFERENCES `dossier_documents`(`dossier_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "dossier_upload_intents_revision_check" CHECK("dossier_upload_intents"."expected_dossier_revision" >= 1),
	CONSTRAINT "dossier_upload_intents_media_check" CHECK("dossier_upload_intents"."expected_media_type" in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown')),
	CONSTRAINT "dossier_upload_intents_size_check" CHECK("dossier_upload_intents"."expected_byte_length" between 1 and 100000000),
	CONSTRAINT "dossier_upload_intents_state_check" CHECK("dossier_upload_intents"."state" in ('pending','expired','committed','deleting','deleted')),
	CONSTRAINT "dossier_upload_intents_idempotency_hash_check" CHECK(length("dossier_upload_intents"."idempotency_key_hash") = 71 and substr("dossier_upload_intents"."idempotency_key_hash", 1, 7) = 'sha256-' and substr("dossier_upload_intents"."idempotency_key_hash", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_upload_intents_request_binding_check" CHECK(length("dossier_upload_intents"."request_binding_digest") = 71 and substr("dossier_upload_intents"."request_binding_digest", 1, 7) = 'sha256-' and substr("dossier_upload_intents"."request_binding_digest", 8) not glob '*[^0-9a-f]*'),
	CONSTRAINT "dossier_upload_intents_hash_check" CHECK("dossier_upload_intents"."expected_content_sha256" is null or (length("dossier_upload_intents"."expected_content_sha256") = 71 and substr("dossier_upload_intents"."expected_content_sha256", 1, 7) = 'sha256-' and substr("dossier_upload_intents"."expected_content_sha256", 8) not glob '*[^0-9a-f]*')),
	CONSTRAINT "dossier_upload_intents_measured_check" CHECK(("dossier_upload_intents"."measured_media_type" is null and "dossier_upload_intents"."measured_byte_length" is null and "dossier_upload_intents"."measured_content_sha256" is null) or ("dossier_upload_intents"."measured_media_type" in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown') and "dossier_upload_intents"."measured_byte_length" between 1 and 100000000 and length("dossier_upload_intents"."measured_content_sha256") = 71 and substr("dossier_upload_intents"."measured_content_sha256", 1, 7) = 'sha256-' and substr("dossier_upload_intents"."measured_content_sha256", 8) not glob '*[^0-9a-f]*')),
	CONSTRAINT "dossier_upload_intents_failure_code_check" CHECK("dossier_upload_intents"."failure_code" is null or (length("dossier_upload_intents"."failure_code") between 1 and 100 and "dossier_upload_intents"."failure_code" not glob '*[^A-Z0-9_]*'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_intents_scope_uidx` ON `dossier_upload_intents` (`dossier_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_intents_idempotency_uidx` ON `dossier_upload_intents` (`dossier_id`,`actor_ref`,`idempotency_key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_intents_temporary_object_uidx` ON `dossier_upload_intents` (`temporary_object_reference`);--> statement-breakpoint
CREATE INDEX `dossier_upload_intents_cleanup_idx` ON `dossier_upload_intents` (`state`,`expires_at`);--> statement-breakpoint
CREATE INDEX `dossier_upload_intents_document_created_idx` ON `dossier_upload_intents` (`dossier_id`,`document_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `dossiers` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`title` text NOT NULL,
	`dossier_type_registry` text NOT NULL,
	`dossier_type_id` text NOT NULL,
	`dossier_type_version` text NOT NULL,
	`terminology` text DEFAULT 'matter' NOT NULL,
	`owner_user_id` integer NOT NULL,
	`owner_actor_id` text NOT NULL,
	`organisation_id` text,
	`jurisdictions` text NOT NULL,
	`classification` text DEFAULT 'confidential' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`status_reason` text,
	`key_deadline_at` text,
	`key_deadline_timezone` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`closed_at` text,
	`closed_by_actor_ref` text,
	`closure_reason` text,
	`archived_at` text,
	`archived_by_actor_ref` text,
	`archive_reason` text,
	`archive_admin_override` integer DEFAULT false NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`updated_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`,`owner_actor_id`) REFERENCES `users`(`id`,`actor_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`id`,`revision`) REFERENCES `dossier_revision_receipts`(`dossier_id`,`resulting_revision`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "dossiers_terminology_check" CHECK("dossiers"."terminology" in ('matter','dossier','engagement','case')),
	CONSTRAINT "dossiers_no_fake_organisation_check" CHECK("dossiers"."organisation_id" is null),
	CONSTRAINT "dossiers_classification_check" CHECK("dossiers"."classification" in ('public','internal','confidential','strictly_confidential')),
	CONSTRAINT "dossiers_priority_check" CHECK("dossiers"."priority" in ('low','normal','high','urgent')),
	CONSTRAINT "dossiers_status_check" CHECK("dossiers"."status" in ('draft','intake_review','active','awaiting_input','internal_review','output_approved','closed','archived','declined','cancelled')),
	CONSTRAINT "dossiers_revision_check" CHECK("dossiers"."revision" >= 1),
	CONSTRAINT "dossiers_deadline_pair_check" CHECK(("dossiers"."key_deadline_at" is null) = ("dossiers"."key_deadline_timezone" is null)),
	CONSTRAINT "dossiers_jurisdictions_check" CHECK(json_valid("dossiers"."jurisdictions") and json_type("dossiers"."jurisdictions") = 'array' and json_array_length("dossiers"."jurisdictions") between 1 and 20),
	CONSTRAINT "dossiers_closure_check" CHECK("dossiers"."status" <> 'closed' or ("dossiers"."closed_at" is not null and "dossiers"."closed_by_actor_ref" is not null and "dossiers"."closure_reason" is not null)),
	CONSTRAINT "dossiers_archive_check" CHECK("dossiers"."status" <> 'archived' or ("dossiers"."archived_at" is not null and "dossiers"."archived_by_actor_ref" is not null and "dossiers"."archive_reason" is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossiers_reference_uidx` ON `dossiers` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `dossiers_revision_status_uidx` ON `dossiers` (`id`,`revision`,`status`);--> statement-breakpoint
CREATE INDEX `dossiers_owner_status_updated_idx` ON `dossiers` (`owner_user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `dossiers_status_deadline_idx` ON `dossiers` (`status`,`key_deadline_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `actor_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_actor_id_uidx` ON `users` (`actor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_actor_identity_uidx` ON `users` (`id`,`actor_id`);--> statement-breakpoint
UPDATE `users`
SET `actor_id` = 'actor_' || lower(hex(randomblob(16)))
WHERE `actor_id` IS NULL;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `users_actor_id_fill`
AFTER INSERT ON `users`
FOR EACH ROW
WHEN NEW.`actor_id` IS NULL
BEGIN
	UPDATE `users`
	SET `actor_id` = 'actor_' || lower(hex(randomblob(16)))
	WHERE `id` = NEW.`id`;
END;--> statement-breakpoint

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
END;--> statement-breakpoint

-- Every authoritative dossier mutation advances the optimistic revision once.
CREATE TRIGGER `dossiers_revision_guard`
BEFORE UPDATE ON `dossiers`
FOR EACH ROW
WHEN NEW.`revision` <> OLD.`revision` + 1
BEGIN
	SELECT RAISE(ABORT, 'dossier revision must advance exactly once');
END;--> statement-breakpoint

CREATE TRIGGER `dossiers_owner_transfer_guard`
BEFORE UPDATE OF `owner_user_id`, `owner_actor_id` ON `dossiers`
FOR EACH ROW
WHEN NEW.`owner_user_id` IS NOT OLD.`owner_user_id`
	OR NEW.`owner_actor_id` IS NOT OLD.`owner_actor_id`
BEGIN
	SELECT RAISE(ABORT, 'dossier ownership transfer requires a governed workflow');
END;--> statement-breakpoint

CREATE TRIGGER `dossiers_delete_guard`
BEFORE DELETE ON `dossiers`
BEGIN
	SELECT RAISE(ABORT, 'governed dossiers cannot be hard-deleted');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_participants_owner_insert_guard`
BEFORE INSERT ON `dossier_participants`
FOR EACH ROW
WHEN (NEW.`role` = 'owner' AND NEW.`status` = 'active') <> (
	NEW.`user_id` = (SELECT `owner_user_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
	AND NEW.`actor_id` = (SELECT `owner_actor_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
)
BEGIN
	SELECT RAISE(ABORT, 'dossier owner participant must match the server-owned dossier owner');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_participants_owner_update_guard`
BEFORE UPDATE OF `user_id`, `actor_id`, `role`, `status` ON `dossier_participants`
FOR EACH ROW
WHEN (NEW.`role` = 'owner' AND NEW.`status` = 'active') <> (
	NEW.`user_id` = (SELECT `owner_user_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
	AND NEW.`actor_id` = (SELECT `owner_actor_id` FROM `dossiers` WHERE `id` = NEW.`dossier_id`)
)
BEGIN
	SELECT RAISE(ABORT, 'dossier owner participant must match the server-owned dossier owner');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_participants_owner_delete_guard`
BEFORE DELETE ON `dossier_participants`
FOR EACH ROW
WHEN OLD.`role` = 'owner' AND OLD.`status` = 'active'
BEGIN
	SELECT RAISE(ABORT, 'active dossier owner participant cannot be deleted');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_participants_delete_guard`
BEFORE DELETE ON `dossier_participants`
BEGIN
	SELECT RAISE(ABORT, 'dossier participants must be removed, not hard-deleted');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_status_transitions_update_guard`
BEFORE UPDATE ON `dossier_status_transitions`
BEGIN
	SELECT RAISE(ABORT, 'dossier status transitions are append-only');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_status_transitions_delete_guard`
BEFORE DELETE ON `dossier_status_transitions`
BEGIN
	SELECT RAISE(ABORT, 'dossier status transitions are append-only');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_documents_insert_provisional_guard`
BEFORE INSERT ON `dossier_documents`
FOR EACH ROW
WHEN NEW.`is_provisional` <> true
BEGIN
	SELECT RAISE(ABORT, 'all logical documents must begin provisional');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_documents_reservation_guard`
BEFORE INSERT ON `dossier_documents`
FOR EACH ROW
WHEN (
	SELECT count(*) FROM `dossier_documents`
	WHERE `dossier_id` = NEW.`dossier_id`
) >= 100
BEGIN
	SELECT RAISE(ABORT, 'dossier document reservation quota exceeded');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_document_versions_update_guard`
BEFORE UPDATE ON `dossier_document_versions`
BEGIN
	SELECT RAISE(ABORT, 'document versions are immutable');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_document_versions_delete_guard`
BEFORE DELETE ON `dossier_document_versions`
BEGIN
	SELECT RAISE(ABORT, 'document versions are immutable');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_document_current_versions_delete_guard`
BEFORE DELETE ON `dossier_document_current_versions`
BEGIN
	SELECT RAISE(ABORT, 'current document version pointer cannot be deleted');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_upload_intents_insert_state_guard`
BEFORE INSERT ON `dossier_upload_intents`
FOR EACH ROW
WHEN NEW.`state` <> 'pending' OR NEW.`committed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'upload intents must be inserted pending');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_upload_intents_failure_guard`
BEFORE UPDATE ON `dossier_upload_intents`
FOR EACH ROW
WHEN (OLD.`failure_code` IS NOT NULL AND NEW.`failure_code` IS NOT OLD.`failure_code`)
	OR (OLD.`failure_code` IS NULL AND NEW.`failure_code` IS NOT NULL AND (
		OLD.`state` <> 'pending' OR NEW.`state` NOT IN ('pending','deleting')
	))
BEGIN
	SELECT RAISE(ABORT, 'upload failure receipt is immutable and only valid for a pending abort');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_upload_intents_terminal_guard`
BEFORE UPDATE ON `dossier_upload_intents`
FOR EACH ROW
WHEN OLD.`state` IN ('committed','deleted')
BEGIN
	SELECT RAISE(ABORT, 'terminal upload intent is immutable');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_extraction_jobs_result_guard`
BEFORE UPDATE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_extraction_results`
	WHERE `dossier_id` = OLD.`dossier_id` AND `extraction_job_id` = OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'extraction job with an immutable result cannot change');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_extraction_jobs_delete_guard`
BEFORE DELETE ON `dossier_extraction_jobs`
FOR EACH ROW
WHEN EXISTS (
	SELECT 1 FROM `dossier_extraction_results`
	WHERE `dossier_id` = OLD.`dossier_id` AND `extraction_job_id` = OLD.`id`
)
BEGIN
	SELECT RAISE(ABORT, 'extraction job with an immutable result cannot be deleted');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_extraction_results_update_guard`
BEFORE UPDATE ON `dossier_extraction_results`
BEGIN
	SELECT RAISE(ABORT, 'extraction results are immutable');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_extraction_results_delete_guard`
BEFORE DELETE ON `dossier_extraction_results`
BEGIN
	SELECT RAISE(ABORT, 'extraction results are immutable');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_extraction_page_maps_update_guard`
BEFORE UPDATE ON `dossier_extraction_page_maps`
BEGIN
	SELECT RAISE(ABORT, 'extraction page maps are immutable');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_extraction_page_maps_delete_guard`
BEFORE DELETE ON `dossier_extraction_page_maps`
BEGIN
	SELECT RAISE(ABORT, 'extraction page maps are immutable');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_source_anchors_insert_review_guard`
BEFORE INSERT ON `dossier_source_anchors`
FOR EACH ROW
WHEN NEW.`review_state` <> 'pending'
	OR NEW.`reviewer_user_id` IS NOT NULL
	OR NEW.`reviewer_actor_ref` IS NOT NULL
	OR NEW.`reviewed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'source anchors must enter review as pending');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_source_anchors_delete_guard`
BEFORE DELETE ON `dossier_source_anchors`
BEGIN
	SELECT RAISE(ABORT, 'source anchors are governed provenance and cannot be deleted');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_professional_assertions_insert_review_guard`
BEFORE INSERT ON `dossier_professional_assertions`
FOR EACH ROW
WHEN NEW.`status` <> 'needs_review'
	OR NEW.`reviewed_by_user_id` IS NOT NULL
	OR NEW.`reviewed_by_actor_ref` IS NOT NULL
	OR NEW.`reviewed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'professional assertions must enter review as needs_review');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_professional_assertions_delete_guard`
BEFORE DELETE ON `dossier_professional_assertions`
BEGIN
	SELECT RAISE(ABORT, 'professional assertions are governed provenance and cannot be deleted');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_assertion_sources_insert_guard`
BEFORE INSERT ON `dossier_assertion_sources`
FOR EACH ROW
WHEN (SELECT `status` FROM `dossier_professional_assertions`
	WHERE `dossier_id` = NEW.`dossier_id` AND `id` = NEW.`assertion_id`) <> 'needs_review'
BEGIN
	SELECT RAISE(ABORT, 'assertion sources can only be assembled before review');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_assertion_sources_update_guard`
BEFORE UPDATE ON `dossier_assertion_sources`
BEGIN
	SELECT RAISE(ABORT, 'assertion source rows are immutable');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_assertion_sources_delete_guard`
BEFORE DELETE ON `dossier_assertion_sources`
FOR EACH ROW
WHEN (SELECT `status` FROM `dossier_professional_assertions`
	WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`assertion_id`) <> 'needs_review'
BEGIN
	SELECT RAISE(ABORT, 'reviewed assertion provenance cannot be deleted');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

CREATE TRIGGER `dossier_evidence_links_update_guard`
BEFORE UPDATE ON `dossier_evidence_links`
BEGIN
	SELECT RAISE(ABORT, 'reviewed evidence links are immutable');
END;--> statement-breakpoint

CREATE TRIGGER `dossier_evidence_links_delete_guard`
BEFORE DELETE ON `dossier_evidence_links`
BEGIN
	SELECT RAISE(ABORT, 'reviewed evidence links cannot be deleted');
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
END;--> statement-breakpoint

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
CREATE TRIGGER `dossier_snapshot_packages_delete_guard` BEFORE DELETE ON `dossier_snapshot_decision_packages` FOR EACH ROW WHEN (SELECT `sealed` FROM `dossier_snapshots` WHERE `dossier_id` = OLD.`dossier_id` AND `id` = OLD.`snapshot_id`) <> false BEGIN SELECT RAISE(ABORT, 'sealed snapshot manifest rows are immutable'); END;--> statement-breakpoint

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
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `dossiers`
		WHERE `id` = NEW.`dossier_id` AND `revision` = NEW.`source_dossier_revision`
	) THEN RAISE(ABORT, 'decision package must bind the current dossier revision') END;
	SELECT CASE WHEN NEW.`parent_package_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `dossier_decision_package_references`
		WHERE `dossier_id` = NEW.`dossier_id`
			AND `package_id` = NEW.`parent_package_id`
			AND `package_version` = NEW.`parent_package_version`
			AND `package_fingerprint` = NEW.`parent_package_fingerprint`
	) THEN RAISE(ABORT, 'decision package parent tuple must match exact governed lineage') END;
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
	SELECT CASE WHEN NEW.`object_ref_type` <> 'dossier'
		OR NEW.`object_ref_id` <> NEW.`dossier_id`
	THEN RAISE(ABORT, 'AI proposal completion audit must target its canonical dossier') END;
	SELECT CASE WHEN json_valid(NEW.`detail`) <> 1
		OR json_type(NEW.`detail`) <> 'object'
	THEN RAISE(ABORT, 'AI proposal completion audit detail must be bounded metadata') END;
	SELECT CASE WHEN (
		SELECT COUNT(*) FROM json_each(NEW.`detail`)
	) <> 6 OR EXISTS (
		SELECT 1 FROM json_each(NEW.`detail`)
		WHERE `key` NOT IN (
			'job_id','result_code','candidate_count','analyzed_source_count',
			'analyzed_character_count','model_receipt_digest'
		)
	) THEN RAISE(ABORT, 'AI proposal completion audit detail must use its exact six-key receipt') END;
	SELECT CASE WHEN json_type(NEW.`detail`, '$.job_id') <> 'text'
		OR json_type(NEW.`detail`, '$.result_code') <> 'text'
		OR json_type(NEW.`detail`, '$.candidate_count') <> 'integer'
		OR json_type(NEW.`detail`, '$.analyzed_source_count') <> 'integer'
		OR json_type(NEW.`detail`, '$.analyzed_character_count') <> 'integer'
		OR json_type(NEW.`detail`, '$.model_receipt_digest') <> 'text'
		OR length(json_extract(NEW.`detail`, '$.model_receipt_digest')) <> 71
		OR substr(json_extract(NEW.`detail`, '$.model_receipt_digest'), 1, 7) <> 'sha256-'
		OR substr(json_extract(NEW.`detail`, '$.model_receipt_digest'), 8) GLOB '*[^0-9a-f]*'
	THEN RAISE(ABORT, 'AI proposal completion audit receipt types or digest are invalid') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1 FROM `dossier_audit_events` AS prior
		WHERE prior.`dossier_id` = NEW.`dossier_id`
			AND prior.`event_type` = 'proposal_generation_completed'
			AND json_extract(prior.`detail`, '$.job_id') = json_extract(NEW.`detail`, '$.job_id')
	) THEN RAISE(ABORT, 'AI proposal job has one immutable completion audit') END;
	SELECT CASE WHEN NOT EXISTS (
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
	) THEN RAISE(ABORT, 'AI proposal completion audit must bind the exact in-flight result and analyzed ranges') END;
END;--> statement-breakpoint

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
