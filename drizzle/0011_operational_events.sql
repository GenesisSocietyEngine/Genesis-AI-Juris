CREATE TABLE IF NOT EXISTS `operational_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schema` text NOT NULL,
	`occurred_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`request_id` text NOT NULL,
	`event_name` text NOT NULL,
	`route` text NOT NULL,
	`outcome` text NOT NULL,
	`reason` text NOT NULL,
	`response_class` text NOT NULL,
	`latency_ms` integer,
	`operation` text,
	`logical_repository` text,
	`command_count` integer,
	`sample_weight` integer DEFAULT 1 NOT NULL,
	`deployment_version` text NOT NULL,
	`web_commit` text NOT NULL,
	`bundle_revision` integer NOT NULL,
	`runtime_revision` text NOT NULL,
	`played_case_schema_revision` integer NOT NULL,
	CONSTRAINT "operational_events_schema_check" CHECK("operational_events"."schema" = 'genesis.juris.observability.v1'),
	CONSTRAINT "operational_events_request_id_check" CHECK(length("operational_events"."request_id") = 36 and lower("operational_events"."request_id") = "operational_events"."request_id"),
	CONSTRAINT "operational_events_event_name_check" CHECK("operational_events"."event_name" in ('replay.internal_failure','played_case.revision_mismatch','played_case.fingerprint_mismatch','historical_bundle.lookup_miss')),
	CONSTRAINT "operational_events_route_check" CHECK("operational_events"."route" in ('play_sessions','admin')),
	CONSTRAINT "operational_events_outcome_check" CHECK("operational_events"."outcome" in ('expected_rejection','internal_failure')),
	CONSTRAINT "operational_events_reason_check" CHECK("operational_events"."reason" in ('stored_state_divergence','stored_revision_divergence','stored_fingerprint_divergence','runtime_exception','stale_client','requested_identity_mismatch','stored_identity_mismatch','canonical_source_mismatch','manifest_integrity','case_unavailable','version_unavailable','stored_version_unavailable')),
	CONSTRAINT "operational_events_response_class_check" CHECK("operational_events"."response_class" in ('none','2xx','3xx','4xx','5xx','exception')),
	CONSTRAINT "operational_events_latency_check" CHECK("operational_events"."latency_ms" is null or ("operational_events"."latency_ms" >= 0 and "operational_events"."latency_ms" <= 120000)),
	CONSTRAINT "operational_events_operation_check" CHECK("operational_events"."operation" is null or "operational_events"."operation" in ('request','read','insert','purge','start','decision','advance_time','abandon','import','load','save','replay')),
	CONSTRAINT "operational_events_repository_check" CHECK("operational_events"."logical_repository" is null or "operational_events"."logical_repository" in ('none','operational_events','play_sessions','play_events','cases','case_versions')),
	CONSTRAINT "operational_events_command_count_check" CHECK("operational_events"."command_count" is null or ("operational_events"."command_count" >= 0 and "operational_events"."command_count" <= 1000)),
	CONSTRAINT "operational_events_sample_weight_check" CHECK("operational_events"."sample_weight" = 1),
	CONSTRAINT "operational_events_release_revision_check" CHECK("operational_events"."bundle_revision" >= 0 and "operational_events"."played_case_schema_revision" >= 0),
	CONSTRAINT "operational_events_retention_check" CHECK(unixepoch("operational_events"."expires_at") is not null and unixepoch("operational_events"."occurred_at") is not null and unixepoch("operational_events"."expires_at") - unixepoch("operational_events"."occurred_at") = 1209600)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `operational_events_expiry_idx` ON `operational_events` (`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `operational_events_occurred_idx` ON `operational_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `operational_events_event_outcome_occurred_idx` ON `operational_events` (`event_name`,`outcome`,`occurred_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `operational_events_route_occurred_idx` ON `operational_events` (`route`,`occurred_at`);
