CREATE TABLE `dossier_ai_proposal_anchors` (
	`dossier_id` text NOT NULL,
	`proposal_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`proposal_id`) REFERENCES `dossier_ai_proposals`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_anchors_uidx` ON `dossier_ai_proposal_anchors` (`dossier_id`,`proposal_id`,`source_anchor_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_ai_proposal_versions_uidx` ON `dossier_ai_proposal_versions` (`dossier_id`,`proposal_id`,`document_version_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_ai_proposal_jobs_scope_uidx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_jobs_idempotency_uidx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`requested_by_actor_ref`,`idempotency_key_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_jobs_request_uidx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`expected_dossier_revision`,`request_digest`);
--> statement-breakpoint
CREATE INDEX `dossier_ai_proposal_jobs_status_lease_idx` ON `dossier_ai_proposal_jobs` (`status`,`lease_expires_at`);
--> statement-breakpoint
CREATE INDEX `dossier_ai_proposal_jobs_dossier_created_idx` ON `dossier_ai_proposal_jobs` (`dossier_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_ai_proposal_job_sources_version_uidx` ON `dossier_ai_proposal_job_sources` (`dossier_id`,`job_id`,`document_version_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_ai_proposal_job_sources_ordinal_uidx` ON `dossier_ai_proposal_job_sources` (`dossier_id`,`job_id`,`source_ordinal`);
--> statement-breakpoint
CREATE INDEX `dossier_ai_proposal_job_sources_result_idx` ON `dossier_ai_proposal_job_sources` (`dossier_id`,`extraction_result_id`,`job_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_ai_proposals_scope_uidx` ON `dossier_ai_proposals` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_ai_proposals_review_created_idx` ON `dossier_ai_proposals` (`dossier_id`,`review_state`,`created_at`);
--> statement-breakpoint
CREATE INDEX `dossier_ai_proposals_job_created_idx` ON `dossier_ai_proposals` (`dossier_id`,`generation_job_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_assertion_sources_uidx` ON `dossier_assertion_sources` (`dossier_id`,`assertion_id`,`source_anchor_id`);
--> statement-breakpoint
CREATE INDEX `dossier_assertion_sources_anchor_idx` ON `dossier_assertion_sources` (`dossier_id`,`source_anchor_id`,`assertion_id`);
--> statement-breakpoint
CREATE TABLE `dossier_revision_receipts` (
	`dossier_id` text NOT NULL,
	`resulting_revision` integer NOT NULL,
	`created_by_actor_ref` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "dossier_revision_receipts_revision_check" CHECK("dossier_revision_receipts"."resulting_revision" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_revision_receipts_revision_uidx` ON `dossier_revision_receipts` (`dossier_id`,`resulting_revision`);
--> statement-breakpoint
CREATE INDEX `dossier_revision_receipts_created_idx` ON `dossier_revision_receipts` (`dossier_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_audit_events_scope_uidx` ON `dossier_audit_events` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_events_sequence_uidx` ON `dossier_audit_events` (`dossier_id`,`sequence`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_audit_events_digest_uidx` ON `dossier_audit_events` (`dossier_id`,`event_digest`);
--> statement-breakpoint
CREATE INDEX `dossier_audit_events_object_occurred_idx` ON `dossier_audit_events` (`dossier_id`,`object_ref_type`,`object_ref_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `dossier_audit_events_occurred_idx` ON `dossier_audit_events` (`dossier_id`,`occurred_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_deadline_references_scope_uidx` ON `dossier_deadline_references` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_deadline_references_status_due_idx` ON `dossier_deadline_references` (`dossier_id`,`status`,`due_at`);
--> statement-breakpoint
CREATE TABLE `dossier_deadline_sources` (
	`dossier_id` text NOT NULL,
	`deadline_reference_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`deadline_reference_id`) REFERENCES `dossier_deadline_references`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_deadline_sources_uidx` ON `dossier_deadline_sources` (`dossier_id`,`deadline_reference_id`,`source_anchor_id`);
--> statement-breakpoint
CREATE INDEX `dossier_deadline_sources_anchor_idx` ON `dossier_deadline_sources` (`dossier_id`,`source_anchor_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_decision_packages_scope_uidx` ON `dossier_decision_package_references` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_decision_packages_version_uidx` ON `dossier_decision_package_references` (`dossier_id`,`package_id`,`package_version`,`package_fingerprint`);
--> statement-breakpoint
CREATE INDEX `dossier_decision_packages_state_updated_idx` ON `dossier_decision_package_references` (`dossier_id`,`state`,`updated_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_document_current_versions_document_uidx` ON `dossier_document_current_versions` (`dossier_id`,`document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_current_versions_version_uidx` ON `dossier_document_current_versions` (`dossier_id`,`document_id`,`document_version_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_document_versions_scope_uidx` ON `dossier_document_versions` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_document_scope_uidx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_snapshot_binding_uidx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`id`,`content_sha256`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_ordinal_uidx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`ordinal`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_document_versions_object_uidx` ON `dossier_document_versions` (`binary_object_reference`);
--> statement-breakpoint
CREATE INDEX `dossier_document_versions_document_uploaded_idx` ON `dossier_document_versions` (`dossier_id`,`document_id`,`uploaded_at`);
--> statement-breakpoint
CREATE INDEX `dossier_document_versions_hash_idx` ON `dossier_document_versions` (`content_sha256`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_documents_scope_uidx` ON `dossier_documents` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_documents_dossier_status_updated_idx` ON `dossier_documents` (`dossier_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `dossier_documents_provisional_created_idx` ON `dossier_documents` (`dossier_id`,`is_provisional`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_evidence_links_scope_uidx` ON `dossier_evidence_links` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_evidence_links_target_idx` ON `dossier_evidence_links` (`dossier_id`,`target_type`,`target_id`);
--> statement-breakpoint
CREATE INDEX `dossier_evidence_links_package_target_idx` ON `dossier_evidence_links` (`dossier_id`,`decision_package_reference_id`,`target_type`,`target_id`);
--> statement-breakpoint
CREATE INDEX `dossier_evidence_links_anchor_idx` ON `dossier_evidence_links` (`dossier_id`,`source_anchor_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_extraction_jobs_scope_uidx` ON `dossier_extraction_jobs` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_jobs_attempt_uidx` ON `dossier_extraction_jobs` (`dossier_id`,`document_version_id`,`extractor_version`,`attempt`);
--> statement-breakpoint
CREATE INDEX `dossier_extraction_jobs_status_lease_idx` ON `dossier_extraction_jobs` (`status`,`lease_expires_at`);
--> statement-breakpoint
CREATE INDEX `dossier_extraction_jobs_version_created_idx` ON `dossier_extraction_jobs` (`dossier_id`,`document_version_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_extraction_page_maps_scope_uidx` ON `dossier_extraction_page_maps` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_page_maps_range_uidx` ON `dossier_extraction_page_maps` (`dossier_id`,`extraction_result_id`,`page_number`,`start_offset`,`end_offset`);
--> statement-breakpoint
CREATE INDEX `dossier_extraction_page_maps_version_page_idx` ON `dossier_extraction_page_maps` (`dossier_id`,`document_version_id`,`page_number`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_extraction_results_scope_uidx` ON `dossier_extraction_results` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_version_extractor_uidx` ON `dossier_extraction_results` (`dossier_id`,`document_version_id`,`extractor_version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_job_uidx` ON `dossier_extraction_results` (`dossier_id`,`extraction_job_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_extraction_results_object_uidx` ON `dossier_extraction_results` (`extracted_text_object_reference`);
--> statement-breakpoint
CREATE INDEX `dossier_extraction_results_version_created_idx` ON `dossier_extraction_results` (`dossier_id`,`document_version_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_governed_outputs_scope_uidx` ON `dossier_governed_outputs` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_governed_outputs_content_uidx` ON `dossier_governed_outputs` (`content_reference`);
--> statement-breakpoint
CREATE INDEX `dossier_governed_outputs_snapshot_created_idx` ON `dossier_governed_outputs` (`dossier_id`,`snapshot_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_information_requests_scope_uidx` ON `dossier_information_requests` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_information_requests_status_due_idx` ON `dossier_information_requests` (`dossier_id`,`status`,`due_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_output_approvals_scope_uidx` ON `dossier_output_approvals` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_output_approvals_reviewer_uidx` ON `dossier_output_approvals` (`dossier_id`,`output_id`,`reviewer_participant_id`);
--> statement-breakpoint
CREATE INDEX `dossier_output_approvals_output_approved_idx` ON `dossier_output_approvals` (`dossier_id`,`output_id`,`approved_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_output_states_scope_uidx` ON `dossier_output_state_events` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_output_states_sequence_uidx` ON `dossier_output_state_events` (`dossier_id`,`output_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `dossier_output_states_output_occurred_idx` ON `dossier_output_state_events` (`dossier_id`,`output_id`,`occurred_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_participants_scope_uidx` ON `dossier_participants` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_authority_uidx` ON `dossier_participants` (`dossier_id`,`id`,`user_id`,`actor_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_user_uidx` ON `dossier_participants` (`dossier_id`,`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_participants_active_owner_uidx` ON `dossier_participants` (`dossier_id`) WHERE "dossier_participants"."role" = 'owner' and "dossier_participants"."status" = 'active';
--> statement-breakpoint
CREATE INDEX `dossier_participants_user_status_idx` ON `dossier_participants` (`user_id`,`status`,`dossier_id`);
--> statement-breakpoint
CREATE INDEX `dossier_participants_dossier_role_idx` ON `dossier_participants` (`dossier_id`,`role`,`status`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_professional_assertions_scope_uidx` ON `dossier_professional_assertions` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_professional_assertions_status_updated_idx` ON `dossier_professional_assertions` (`dossier_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `dossier_snapshot_anchors` (
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`source_anchor_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`source_anchor_id`) REFERENCES `dossier_source_anchors`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshot_anchors_uidx` ON `dossier_snapshot_anchors` (`dossier_id`,`snapshot_id`,`source_anchor_id`);
--> statement-breakpoint
CREATE TABLE `dossier_snapshot_assertions` (
	`dossier_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`assertion_id` text NOT NULL,
	FOREIGN KEY (`dossier_id`) REFERENCES `dossiers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`snapshot_id`) REFERENCES `dossier_snapshots`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dossier_id`,`assertion_id`) REFERENCES `dossier_professional_assertions`(`dossier_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshot_assertions_uidx` ON `dossier_snapshot_assertions` (`dossier_id`,`snapshot_id`,`assertion_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_snapshot_packages_uidx` ON `dossier_snapshot_decision_packages` (`dossier_id`,`snapshot_id`,`decision_package_reference_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_snapshot_documents_uidx` ON `dossier_snapshot_document_versions` (`dossier_id`,`snapshot_id`,`document_id`);
--> statement-breakpoint
CREATE INDEX `dossier_snapshot_documents_version_idx` ON `dossier_snapshot_document_versions` (`dossier_id`,`document_version_id`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_snapshots_scope_uidx` ON `dossier_snapshots` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshots_manifest_uidx` ON `dossier_snapshots` (`dossier_id`,`manifest_digest`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_snapshots_manifest_object_uidx` ON `dossier_snapshots` (`manifest_object_reference`);
--> statement-breakpoint
CREATE INDEX `dossier_snapshots_revision_created_idx` ON `dossier_snapshots` (`dossier_id`,`dossier_revision`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_source_anchors_scope_uidx` ON `dossier_source_anchors` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE INDEX `dossier_source_anchors_version_review_idx` ON `dossier_source_anchors` (`dossier_id`,`document_version_id`,`review_state`);
--> statement-breakpoint
CREATE INDEX `dossier_source_anchors_dossier_created_idx` ON `dossier_source_anchors` (`dossier_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_status_transitions_scope_uidx` ON `dossier_status_transitions` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_status_transitions_revision_uidx` ON `dossier_status_transitions` (`dossier_id`,`revision_after`);
--> statement-breakpoint
CREATE INDEX `dossier_status_transitions_dossier_occurred_idx` ON `dossier_status_transitions` (`dossier_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `dossier_status_transitions_approved_output_idx` ON `dossier_status_transitions` (`dossier_id`,`approved_output_id`,`revision_after`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossier_upload_intents_scope_uidx` ON `dossier_upload_intents` (`dossier_id`,`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_intents_idempotency_uidx` ON `dossier_upload_intents` (`dossier_id`,`actor_ref`,`idempotency_key_hash`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossier_upload_intents_temporary_object_uidx` ON `dossier_upload_intents` (`temporary_object_reference`);
--> statement-breakpoint
CREATE INDEX `dossier_upload_intents_cleanup_idx` ON `dossier_upload_intents` (`state`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `dossier_upload_intents_document_created_idx` ON `dossier_upload_intents` (`dossier_id`,`document_id`,`created_at`);
--> statement-breakpoint
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
CREATE UNIQUE INDEX `dossiers_reference_uidx` ON `dossiers` (`reference`);
--> statement-breakpoint
CREATE UNIQUE INDEX `dossiers_revision_status_uidx` ON `dossiers` (`id`,`revision`,`status`);
--> statement-breakpoint
CREATE INDEX `dossiers_owner_status_updated_idx` ON `dossiers` (`owner_user_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `dossiers_status_deadline_idx` ON `dossiers` (`status`,`key_deadline_at`);
--> statement-breakpoint
ALTER TABLE `users` ADD `actor_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_actor_id_uidx` ON `users` (`actor_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_actor_identity_uidx` ON `users` (`id`,`actor_id`);
--> statement-breakpoint
UPDATE `users`
SET `actor_id` = 'actor_' || lower(hex(randomblob(16)))
WHERE `actor_id` IS NULL;
