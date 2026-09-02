-- Phase B1 control-plane foundation only.
--
-- This migration deliberately does not assign an organization to any legacy
-- row and does not create dossier, document, upload, OCR, extraction, queue,
-- or other Phase B2/Phase C aggregates. The real v62 dossier graph must be
-- tenant-bound in B2; inventing parallel placeholder tables here would make
-- that work less safe.
--
-- `closing` is an internal persistence state required by the Phase B lifecycle.
-- It is not exposed by the frozen organization-contract.v1 public enum. Public
-- exposure remains blocked on an additive contract version and ADR approval.
--
-- D1's migration runner supplies the transaction boundary. Any direct runner
-- must execute this whole file in one transaction and roll back on failure.

CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'provisioning' NOT NULL,
	`controller_processor_mode` text NOT NULL,
	`data_region` text DEFAULT 'eu' NOT NULL,
	`confidential_document_mode` text DEFAULT 'disabled' NOT NULL,
	`confidential_document_mode_version` integer DEFAULT 1 NOT NULL,
	`authorization_version` integer DEFAULT 1 NOT NULL,
	`configuration_version` integer DEFAULT 1 NOT NULL,
	`suspension_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `organizations_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organizations_display_name_check` CHECK(length(`display_name`) BETWEEN 1 AND 160),
	CONSTRAINT `organizations_slug_check` CHECK(length(`slug`) BETWEEN 1 AND 63 AND `slug` NOT GLOB '*[^a-z0-9-]*' AND `slug` NOT GLOB '-*' AND `slug` NOT GLOB '*-' AND `slug` NOT GLOB '*--*'),
	CONSTRAINT `organizations_status_check` CHECK(`status` IN ('provisioning', 'active', 'suspended', 'closing', 'closed')),
	CONSTRAINT `organizations_mode_check` CHECK(`controller_processor_mode` IN ('controller', 'processor', 'joint_controller')),
	CONSTRAINT `organizations_region_check` CHECK(`data_region` = 'eu'),
	CONSTRAINT `organizations_confidential_mode_check` CHECK(`confidential_document_mode` IN ('disabled', 'validation', 'approved')),
	CONSTRAINT `organizations_versions_check` CHECK(`confidential_document_mode_version` >= 1 AND `authorization_version` >= 1 AND `configuration_version` >= 1),
	CONSTRAINT `organizations_suspension_reason_check` CHECK(`suspension_reason` IS NULL OR (`status` = 'suspended' AND length(`suspension_reason`) BETWEEN 1 AND 500))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_uidx` ON `organizations` (`slug`);
--> statement-breakpoint
CREATE INDEX `organizations_status_region_idx` ON `organizations` (`status`, `data_region`);
--> statement-breakpoint

CREATE TABLE `organization_lifecycle_transitions` (
	`organization_id` text NOT NULL,
	`transition_version` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason_code` text NOT NULL,
	`actor_subject_hmac_sha256` text NOT NULL,
	`receipt_sha256` text NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY (`organization_id`, `transition_version`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_lifecycle_version_check` CHECK(`transition_version` >= 2),
	CONSTRAINT `organization_lifecycle_from_check` CHECK(`from_status` IN ('provisioning', 'active', 'suspended', 'closing')),
	CONSTRAINT `organization_lifecycle_to_check` CHECK(`to_status` IN ('active', 'suspended', 'closing', 'closed')),
	CONSTRAINT `organization_lifecycle_reason_check` CHECK(length(`reason_code`) BETWEEN 1 AND 64 AND `reason_code` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_lifecycle_actor_digest_check` CHECK(length(`actor_subject_hmac_sha256`) = 64 AND `actor_subject_hmac_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_lifecycle_receipt_check` CHECK(length(`receipt_sha256`) = 64 AND `receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_lifecycle_occurred_at_check` CHECK(julianday(`occurred_at`) IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_lifecycle_receipt_uidx` ON `organization_lifecycle_transitions` (`receipt_sha256`);
--> statement-breakpoint
CREATE INDEX `organization_lifecycle_status_idx` ON `organization_lifecycle_transitions` (`organization_id`, `to_status`, `occurred_at`);
--> statement-breakpoint

CREATE TABLE `organization_identity_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text DEFAULT 'entra_oidc' NOT NULL,
	`issuer` text NOT NULL,
	`verified_tenant_id` text NOT NULL,
	`client_id` text NOT NULL,
	`discovery_document_sha256` text NOT NULL,
	`jwks_document_sha256` text NOT NULL,
	`status` text DEFAULT 'pending_consent' NOT NULL,
	`configuration_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_identity_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_identity_provider_check` CHECK(`provider` = 'entra_oidc'),
	CONSTRAINT `organization_identity_issuer_check` CHECK(length(`issuer`) BETWEEN 8 AND 512 AND substr(`issuer`, 1, 8) = 'https://' AND instr(`issuer`, ' ') = 0 AND instr(`issuer`, char(9)) = 0 AND instr(`issuer`, char(10)) = 0 AND instr(`issuer`, char(13)) = 0),
	CONSTRAINT `organization_identity_tenant_check` CHECK(length(`verified_tenant_id`) BETWEEN 3 AND 128 AND instr(`verified_tenant_id`, ' ') = 0 AND instr(`verified_tenant_id`, char(9)) = 0 AND instr(`verified_tenant_id`, char(10)) = 0 AND instr(`verified_tenant_id`, char(13)) = 0),
	CONSTRAINT `organization_identity_client_check` CHECK(length(`client_id`) BETWEEN 3 AND 256 AND instr(`client_id`, ' ') = 0 AND instr(`client_id`, char(9)) = 0 AND instr(`client_id`, char(10)) = 0 AND instr(`client_id`, char(13)) = 0),
	CONSTRAINT `organization_identity_discovery_digest_check` CHECK(length(`discovery_document_sha256`) = 64 AND `discovery_document_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_identity_jwks_digest_check` CHECK(length(`jwks_document_sha256`) = 64 AND `jwks_document_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_identity_status_check` CHECK(`status` IN ('pending_consent', 'active', 'suspended', 'revoked')),
	CONSTRAINT `organization_identity_version_check` CHECK(`configuration_version` >= 1),
	UNIQUE (`organization_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_identity_tenant_uidx` ON `organization_identity_connections` (`organization_id`, `provider`, `verified_tenant_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_identity_verified_tenant_uidx` ON `organization_identity_connections` (`provider`, `verified_tenant_id`);
--> statement-breakpoint
CREATE INDEX `organization_identity_status_idx` ON `organization_identity_connections` (`organization_id`, `status`);
--> statement-breakpoint

CREATE TABLE `organization_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`actor_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`authorization_version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_memberships_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_memberships_actor_id_check` CHECK(length(`actor_id`) BETWEEN 20 AND 128 AND `actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_memberships_role_check` CHECK(`role` IN ('org_owner', 'org_admin', 'member', 'auditor')),
	CONSTRAINT `organization_memberships_status_check` CHECK(`status` IN ('active', 'suspended', 'removed')),
	CONSTRAINT `organization_memberships_version_check` CHECK(`authorization_version` >= 1),
	UNIQUE (`organization_id`, `id`),
	UNIQUE (`organization_id`, `id`, `actor_id`),
	UNIQUE (`organization_id`, `actor_id`),
	UNIQUE (`organization_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `organization_memberships_user_status_idx` ON `organization_memberships` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `organization_memberships_actor_status_idx` ON `organization_memberships` (`actor_id`, `status`);
--> statement-breakpoint
CREATE INDEX `organization_memberships_org_role_status_idx` ON `organization_memberships` (`organization_id`, `role`, `status`);
--> statement-breakpoint

CREATE TABLE `organization_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`invited_by_membership_id` text NOT NULL,
	`accepted_by_membership_id` text,
	`intended_role` text NOT NULL,
	`intended_identity_issuer` text NOT NULL,
	`intended_identity_tenant_id` text NOT NULL,
	`intended_identity_subject` text NOT NULL,
	`exact_origin` text NOT NULL,
	`token_sha256` text NOT NULL,
	`delivery_address_hmac_sha256` text NOT NULL,
	`delivery_address_algorithm` text,
	`delivery_address_key_alias` text,
	`delivery_address_key_version` integer,
	`delivery_address_iv` text,
	`delivery_address_ciphertext` text,
	`delivery_address_aad_sha256` text,
	`status` text DEFAULT 'active' NOT NULL,
	`authorization_version` integer DEFAULT 1 NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`, `invited_by_membership_id`) REFERENCES `organization_memberships`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `accepted_by_membership_id`) REFERENCES `organization_memberships`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_invitations_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_invitations_role_check` CHECK(`intended_role` IN ('org_owner', 'org_admin', 'member', 'auditor')),
	CONSTRAINT `organization_invitations_identity_issuer_check` CHECK(length(`intended_identity_issuer`) BETWEEN 8 AND 512 AND substr(`intended_identity_issuer`, 1, 8) = 'https://' AND instr(`intended_identity_issuer`, '@') = 0 AND instr(`intended_identity_issuer`, ' ') = 0 AND instr(`intended_identity_issuer`, char(9)) = 0 AND instr(`intended_identity_issuer`, char(10)) = 0 AND instr(`intended_identity_issuer`, char(13)) = 0 AND instr(`intended_identity_issuer`, '?') = 0 AND instr(`intended_identity_issuer`, '#') = 0),
	CONSTRAINT `organization_invitations_identity_tenant_check` CHECK(length(`intended_identity_tenant_id`) BETWEEN 3 AND 128 AND `intended_identity_tenant_id` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_invitations_identity_subject_check` CHECK(length(`intended_identity_subject`) BETWEEN 3 AND 128 AND `intended_identity_subject` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_invitations_exact_origin_check` CHECK(length(`exact_origin`) BETWEEN 9 AND 253 AND substr(`exact_origin`, 1, 8) = 'https://' AND instr(substr(`exact_origin`, 9), '/') = 0 AND instr(`exact_origin`, '@') = 0 AND instr(`exact_origin`, '?') = 0 AND instr(`exact_origin`, '#') = 0 AND instr(`exact_origin`, ' ') = 0 AND instr(`exact_origin`, char(9)) = 0 AND instr(`exact_origin`, char(10)) = 0 AND instr(`exact_origin`, char(13)) = 0),
	CONSTRAINT `organization_invitations_token_digest_check` CHECK(length(`token_sha256`) = 64 AND `token_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_invitations_address_digest_check` CHECK(length(`delivery_address_hmac_sha256`) = 64 AND `delivery_address_hmac_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_invitations_status_check` CHECK(`status` IN ('active', 'accepted', 'revoked', 'expired')),
	CONSTRAINT `organization_invitations_version_check` CHECK(`authorization_version` >= 1),
	CONSTRAINT `organization_invitations_acceptance_shape_check` CHECK((`status` = 'accepted' AND `accepted_by_membership_id` IS NOT NULL AND julianday(`accepted_at`) IS NOT NULL AND julianday(`accepted_at`) >= julianday(`created_at`) AND julianday(`accepted_at`) <= julianday(`expires_at`)) OR (`status` <> 'accepted' AND `accepted_by_membership_id` IS NULL AND `accepted_at` IS NULL)),
	CONSTRAINT `organization_invitations_expiry_check` CHECK(julianday(`created_at`) IS NOT NULL AND julianday(`expires_at`) IS NOT NULL AND (julianday(`expires_at`) - julianday(`created_at`)) * 86400 >= 60 AND julianday(`expires_at`) <= julianday(`created_at`) + 1),
	CONSTRAINT `organization_invitations_delivery_envelope_check` CHECK((`status` = 'active' AND `delivery_address_algorithm` IS NOT NULL AND `delivery_address_algorithm` = 'A256GCM' AND `delivery_address_key_alias` IS NOT NULL AND length(`delivery_address_key_alias`) BETWEEN 8 AND 160 AND `delivery_address_key_alias` GLOB 'live/*' AND `delivery_address_key_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND `delivery_address_key_version` IS NOT NULL AND `delivery_address_key_version` >= 1 AND `delivery_address_iv` IS NOT NULL AND length(`delivery_address_iv`) BETWEEN 16 AND 32 AND `delivery_address_iv` NOT GLOB '*[^A-Za-z0-9_-]*' AND `delivery_address_ciphertext` IS NOT NULL AND length(`delivery_address_ciphertext`) BETWEEN 24 AND 4096 AND `delivery_address_ciphertext` NOT GLOB '*[^A-Za-z0-9_-]*' AND `delivery_address_aad_sha256` IS NOT NULL AND length(`delivery_address_aad_sha256`) = 64 AND `delivery_address_aad_sha256` NOT GLOB '*[^0-9a-f]*') OR (`status` <> 'active' AND `delivery_address_algorithm` IS NULL AND `delivery_address_key_alias` IS NULL AND `delivery_address_key_version` IS NULL AND `delivery_address_iv` IS NULL AND `delivery_address_ciphertext` IS NULL AND `delivery_address_aad_sha256` IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_invitations_token_uidx` ON `organization_invitations` (`token_sha256`);
--> statement-breakpoint
CREATE INDEX `organization_invitations_org_status_expiry_idx` ON `organization_invitations` (`organization_id`, `status`, `expires_at`);
--> statement-breakpoint

CREATE TABLE `organization_policy_versions` (
	`organization_id` text NOT NULL,
	`policy_revision` integer NOT NULL,
	`retention_version` text NOT NULL,
	`deletion_version` text NOT NULL,
	`export_version` text NOT NULL,
	`legal_hold_version` text NOT NULL,
	`offline_mobile_version` text NOT NULL,
	`ai_disclosure_version` text NOT NULL,
	`session_version` text NOT NULL,
	`data_classification_version` text NOT NULL,
	`created_by_actor_hmac_sha256` text NOT NULL,
	`receipt_sha256` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `policy_revision`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_policy_revision_check` CHECK(`policy_revision` >= 1),
	CONSTRAINT `organization_policy_retention_check` CHECK(length(`retention_version`) BETWEEN 1 AND 64 AND `retention_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_deletion_check` CHECK(length(`deletion_version`) BETWEEN 1 AND 64 AND `deletion_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_export_check` CHECK(length(`export_version`) BETWEEN 1 AND 64 AND `export_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_legal_hold_check` CHECK(length(`legal_hold_version`) BETWEEN 1 AND 64 AND `legal_hold_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_offline_check` CHECK(length(`offline_mobile_version`) BETWEEN 1 AND 64 AND `offline_mobile_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_ai_check` CHECK(length(`ai_disclosure_version`) BETWEEN 1 AND 64 AND `ai_disclosure_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_session_check` CHECK(length(`session_version`) BETWEEN 1 AND 64 AND `session_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_classification_check` CHECK(length(`data_classification_version`) BETWEEN 1 AND 64 AND `data_classification_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_policy_actor_digest_check` CHECK(length(`created_by_actor_hmac_sha256`) = 64 AND `created_by_actor_hmac_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_policy_receipt_check` CHECK(length(`receipt_sha256`) = 64 AND `receipt_sha256` NOT GLOB '*[^0-9a-f]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_policy_receipt_uidx` ON `organization_policy_versions` (`receipt_sha256`);
--> statement-breakpoint

CREATE TABLE `organization_policy_current` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`policy_revision` integer NOT NULL,
	`pointer_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`, `policy_revision`) REFERENCES `organization_policy_versions`(`organization_id`, `policy_revision`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_policy_current_versions_check` CHECK(`policy_revision` >= 1 AND `pointer_version` >= 1)
);
--> statement-breakpoint

CREATE TABLE `tenant_resource_manifests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`manifest_revision` integer NOT NULL,
	`manifest_version` text DEFAULT 'tenant-resource-manifest.v1' NOT NULL,
	`environment` text NOT NULL,
	`jurisdiction` text DEFAULT 'eu' NOT NULL,
	`hostname` text NOT NULL,
	`d1_database_id` text NOT NULL,
	`r2_quarantine_id` text NOT NULL,
	`r2_quarantine_binding_alias` text NOT NULL,
	`r2_clean_id` text NOT NULL,
	`r2_clean_binding_alias` text NOT NULL,
	`r2_extracted_text_id` text NOT NULL,
	`r2_extracted_text_binding_alias` text NOT NULL,
	`r2_exports_id` text NOT NULL,
	`r2_exports_binding_alias` text NOT NULL,
	`r2_backups_id` text NOT NULL,
	`r2_backups_binding_alias` text NOT NULL,
	`live_data_key_alias` text NOT NULL,
	`export_key_alias` text NOT NULL,
	`backup_key_alias` text NOT NULL,
	`restore_key_alias` text NOT NULL,
	`processing_evidence_set_sha256` text NOT NULL,
	`schema_version` text NOT NULL,
	`deployment_sha` text NOT NULL,
	`activation` text DEFAULT 'disabled' NOT NULL,
	`activation_validator_version` text,
	`activation_evaluated_at` text,
	`activation_valid_until` text,
	`activation_receipt_set_sha256` text,
	`activation_validation_receipt_sha256` text,
	`verification_receipt_sha256` text NOT NULL,
	`verified_at` text NOT NULL,
	`verification_expires_at` text NOT NULL,
	`canonical_manifest_sha256` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_resource_manifest_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_resource_manifest_revision_check` CHECK(`manifest_revision` >= 1),
	CONSTRAINT `tenant_resource_manifest_version_check` CHECK(`manifest_version` = 'tenant-resource-manifest.v1'),
	CONSTRAINT `tenant_resource_manifest_environment_check` CHECK(`environment` IN ('development', 'validation', 'production')),
	CONSTRAINT `tenant_resource_manifest_jurisdiction_check` CHECK(`jurisdiction` = 'eu'),
	CONSTRAINT `tenant_resource_manifest_hostname_check` CHECK(length(`hostname`) BETWEEN 1 AND 253 AND `hostname` NOT GLOB '*[ /\\]*'),
	CONSTRAINT `tenant_resource_manifest_resource_ids_check` CHECK(length(`d1_database_id`) BETWEEN 20 AND 128 AND `d1_database_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND length(`r2_quarantine_id`) BETWEEN 20 AND 128 AND `r2_quarantine_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND length(`r2_clean_id`) BETWEEN 20 AND 128 AND `r2_clean_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND length(`r2_extracted_text_id`) BETWEEN 20 AND 128 AND `r2_extracted_text_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND length(`r2_exports_id`) BETWEEN 20 AND 128 AND `r2_exports_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND length(`r2_backups_id`) BETWEEN 20 AND 128 AND `r2_backups_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_resource_manifest_binding_aliases_check` CHECK(length(`r2_quarantine_binding_alias`) BETWEEN 14 AND 156 AND `r2_quarantine_binding_alias` GLOB 'quarantine/*' AND `r2_quarantine_binding_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`r2_clean_binding_alias`) BETWEEN 9 AND 156 AND `r2_clean_binding_alias` GLOB 'clean/*' AND `r2_clean_binding_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`r2_extracted_text_binding_alias`) BETWEEN 18 AND 156 AND `r2_extracted_text_binding_alias` GLOB 'extracted-text/*' AND `r2_extracted_text_binding_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`r2_exports_binding_alias`) BETWEEN 11 AND 156 AND `r2_exports_binding_alias` GLOB 'exports/*' AND `r2_exports_binding_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`r2_backups_binding_alias`) BETWEEN 11 AND 156 AND `r2_backups_binding_alias` GLOB 'backups/*' AND `r2_backups_binding_alias` NOT GLOB '*[^A-Za-z0-9/_-]*'),
	CONSTRAINT `tenant_resource_manifest_key_aliases_check` CHECK(length(`live_data_key_alias`) BETWEEN 8 AND 160 AND `live_data_key_alias` GLOB 'live/*' AND `live_data_key_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`export_key_alias`) BETWEEN 10 AND 160 AND `export_key_alias` GLOB 'export/*' AND `export_key_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`backup_key_alias`) BETWEEN 10 AND 160 AND `backup_key_alias` GLOB 'backup/*' AND `backup_key_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND length(`restore_key_alias`) BETWEEN 11 AND 160 AND `restore_key_alias` GLOB 'restore/*' AND `restore_key_alias` NOT GLOB '*[^A-Za-z0-9/_-]*'),
	CONSTRAINT `tenant_resource_manifest_processing_digest_check` CHECK(length(`processing_evidence_set_sha256`) = 64 AND `processing_evidence_set_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_resource_manifest_schema_check` CHECK(length(`schema_version`) BETWEEN 2 AND 32 AND substr(`schema_version`, 1, 1) = 'v' AND substr(`schema_version`, 2) NOT GLOB '*[^0-9]*'),
	CONSTRAINT `tenant_resource_manifest_deployment_check` CHECK(length(`deployment_sha`) = 40 AND `deployment_sha` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_resource_manifest_activation_check` CHECK(`activation` IN ('disabled', 'validation', 'approved', 'suspended')),
	CONSTRAINT `tenant_resource_manifest_activation_shape_check` CHECK((`activation` = 'approved' AND `environment` = 'production' AND `activation_validator_version` = 'tenant-activation-validator.v1' AND `activation_evaluated_at` IS NOT NULL AND `activation_valid_until` IS NOT NULL AND `activation_receipt_set_sha256` IS NOT NULL AND `activation_validation_receipt_sha256` IS NOT NULL) OR (`activation` <> 'approved' AND `activation_validator_version` IS NULL AND `activation_evaluated_at` IS NULL AND `activation_valid_until` IS NULL AND `activation_receipt_set_sha256` IS NULL AND `activation_validation_receipt_sha256` IS NULL)),
	CONSTRAINT `tenant_resource_manifest_activation_receipt_check` CHECK((`activation_receipt_set_sha256` IS NULL OR (length(`activation_receipt_set_sha256`) = 64 AND `activation_receipt_set_sha256` NOT GLOB '*[^0-9a-f]*')) AND (`activation_validation_receipt_sha256` IS NULL OR (length(`activation_validation_receipt_sha256`) = 64 AND `activation_validation_receipt_sha256` NOT GLOB '*[^0-9a-f]*'))),
	CONSTRAINT `tenant_resource_manifest_verification_check` CHECK(length(`verification_receipt_sha256`) = 64 AND `verification_receipt_sha256` NOT GLOB '*[^0-9a-f]*' AND length(`canonical_manifest_sha256`) = 64 AND `canonical_manifest_sha256` NOT GLOB '*[^0-9a-f]*' AND julianday(`verified_at`) IS NOT NULL AND julianday(`verification_expires_at`) IS NOT NULL AND julianday(`verification_expires_at`) > julianday(`verified_at`)),
	UNIQUE (`organization_id`, `id`),
	UNIQUE (`organization_id`, `id`, `manifest_revision`, `environment`),
	UNIQUE (`organization_id`, `manifest_revision`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_resource_manifests_canonical_uidx` ON `tenant_resource_manifests` (`canonical_manifest_sha256`);
--> statement-breakpoint
CREATE INDEX `tenant_resource_manifests_org_environment_activation_idx` ON `tenant_resource_manifests` (`organization_id`, `environment`, `activation`);
--> statement-breakpoint

CREATE TABLE `tenant_resource_manifest_components` (
	`organization_id` text NOT NULL,
	`manifest_id` text NOT NULL,
	`component` text NOT NULL,
	`binding_id` text NOT NULL,
	`jurisdiction` text DEFAULT 'eu' NOT NULL,
	`receipt_sha256` text NOT NULL,
	`verified_at` text NOT NULL,
	`expires_at` text NOT NULL,
	PRIMARY KEY (`organization_id`, `manifest_id`, `component`),
	FOREIGN KEY (`organization_id`, `manifest_id`) REFERENCES `tenant_resource_manifests`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_resource_manifest_components_component_check` CHECK(`component` IN ('workers', 'queues', 'cron', 'malware_scanning', 'extraction', 'ocr', 'kms', 'logging', 'analytics', 'backup_restore', 'support', 'ai')),
	CONSTRAINT `tenant_resource_manifest_components_binding_check` CHECK(length(`binding_id`) BETWEEN 20 AND 128 AND `binding_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_resource_manifest_components_region_check` CHECK(`jurisdiction` = 'eu'),
	CONSTRAINT `tenant_resource_manifest_components_receipt_check` CHECK(length(`receipt_sha256`) = 64 AND `receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_resource_manifest_components_expiry_check` CHECK(julianday(`verified_at`) IS NOT NULL AND julianday(`expires_at`) IS NOT NULL AND julianday(`expires_at`) > julianday(`verified_at`))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_resource_manifest_components_binding_uidx` ON `tenant_resource_manifest_components` (`organization_id`, `manifest_id`, `binding_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_resource_manifest_components_receipt_uidx` ON `tenant_resource_manifest_components` (`organization_id`, `manifest_id`, `receipt_sha256`);
--> statement-breakpoint

CREATE TABLE `tenant_resource_manifest_current` (
	`organization_id` text NOT NULL,
	`environment` text NOT NULL,
	`manifest_id` text NOT NULL,
	`manifest_revision` integer NOT NULL,
	`pointer_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `environment`),
	FOREIGN KEY (`organization_id`, `manifest_id`, `manifest_revision`, `environment`) REFERENCES `tenant_resource_manifests`(`organization_id`, `id`, `manifest_revision`, `environment`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_resource_manifest_current_environment_check` CHECK(`environment` IN ('development', 'validation', 'production')),
	CONSTRAINT `tenant_resource_manifest_current_versions_check` CHECK(`manifest_revision` >= 1 AND `pointer_version` >= 1)
);
--> statement-breakpoint

CREATE TABLE `organization_action_grant_revisions` (
	`organization_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`grant_revision` integer NOT NULL,
	`authority_version` text DEFAULT 'organization-action-authority.v1' NOT NULL,
	`actor_membership_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`issued_by_membership_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`receipt_sha256` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `grant_id`, `grant_revision`),
	FOREIGN KEY (`organization_id`, `actor_membership_id`, `actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `issued_by_membership_id`) REFERENCES `organization_memberships`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_action_grant_id_check` CHECK(length(`grant_id`) BETWEEN 20 AND 128 AND `grant_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_action_grant_actor_id_check` CHECK(length(`actor_id`) BETWEEN 20 AND 128 AND `actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_action_grant_revision_check` CHECK(`grant_revision` >= 1),
	CONSTRAINT `organization_action_grant_authority_check` CHECK(`authority_version` = 'organization-action-authority.v1'),
	CONSTRAINT `organization_action_grant_action_check` CHECK(`action` IN ('member_invite', 'member_suspend')),
	CONSTRAINT `organization_action_grant_status_check` CHECK(`status` IN ('active', 'suspended', 'revoked', 'superseded')),
	CONSTRAINT `organization_action_grant_receipt_check` CHECK(length(`receipt_sha256`) = 64 AND `receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_action_grant_validity_check` CHECK(julianday(`valid_from`) IS NOT NULL AND (`valid_until` IS NULL OR (julianday(`valid_until`) IS NOT NULL AND julianday(`valid_until`) > julianday(`valid_from`)))),
	UNIQUE (`organization_id`, `grant_id`, `grant_revision`, `actor_membership_id`, `actor_id`, `authority_version`, `action`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_action_grant_receipt_uidx` ON `organization_action_grant_revisions` (`receipt_sha256`);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_action_grant_actor_revision_uidx` ON `organization_action_grant_revisions` (`organization_id`, `actor_id`, `action`, `grant_revision`);
--> statement-breakpoint
CREATE INDEX `organization_action_grant_actor_action_idx` ON `organization_action_grant_revisions` (`organization_id`, `actor_id`, `action`, `status`);
--> statement-breakpoint

CREATE TABLE `organization_action_grant_current` (
	`organization_id` text NOT NULL,
	`actor_membership_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`authority_version` text DEFAULT 'organization-action-authority.v1' NOT NULL,
	`action` text NOT NULL,
	`grant_id` text NOT NULL,
	`grant_revision` integer NOT NULL,
	`pointer_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `actor_id`, `authority_version`, `action`),
	FOREIGN KEY (`organization_id`, `actor_membership_id`, `actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `grant_id`, `grant_revision`, `actor_membership_id`, `actor_id`, `authority_version`, `action`) REFERENCES `organization_action_grant_revisions`(`organization_id`, `grant_id`, `grant_revision`, `actor_membership_id`, `actor_id`, `authority_version`, `action`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_action_grant_current_action_check` CHECK(`action` IN ('member_invite', 'member_suspend')),
	CONSTRAINT `organization_action_grant_current_authority_check` CHECK(`authority_version` = 'organization-action-authority.v1'),
	CONSTRAINT `organization_action_grant_current_versions_check` CHECK(`grant_revision` >= 1 AND `pointer_version` >= 1)
);
--> statement-breakpoint

CREATE TABLE `compliance_export_grant_revisions` (
	`organization_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`grant_revision` integer NOT NULL,
	`authority_version` text DEFAULT 'compliance-export-authority.v1' NOT NULL,
	`actor_membership_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`issued_by_membership_id` text NOT NULL,
	`status` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`receipt_sha256` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `grant_id`, `grant_revision`),
	FOREIGN KEY (`organization_id`, `actor_membership_id`, `actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `issued_by_membership_id`) REFERENCES `organization_memberships`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `compliance_export_grant_id_check` CHECK(length(`grant_id`) BETWEEN 20 AND 128 AND `grant_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `compliance_export_grant_actor_id_check` CHECK(length(`actor_id`) BETWEEN 20 AND 128 AND `actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `compliance_export_grant_revision_check` CHECK(`grant_revision` >= 1),
	CONSTRAINT `compliance_export_grant_authority_check` CHECK(`authority_version` = 'compliance-export-authority.v1'),
	CONSTRAINT `compliance_export_grant_status_check` CHECK(`status` IN ('active', 'suspended', 'revoked', 'superseded')),
	CONSTRAINT `compliance_export_grant_receipt_check` CHECK(length(`receipt_sha256`) = 64 AND `receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `compliance_export_grant_validity_check` CHECK(julianday(`valid_from`) IS NOT NULL AND (`valid_until` IS NULL OR (julianday(`valid_until`) IS NOT NULL AND julianday(`valid_until`) > julianday(`valid_from`)))),
	UNIQUE (`organization_id`, `grant_id`, `grant_revision`, `actor_membership_id`, `actor_id`, `authority_version`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_export_grant_receipt_uidx` ON `compliance_export_grant_revisions` (`receipt_sha256`);
--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_export_grant_actor_revision_uidx` ON `compliance_export_grant_revisions` (`organization_id`, `actor_id`, `grant_revision`);
--> statement-breakpoint
CREATE INDEX `compliance_export_grant_actor_idx` ON `compliance_export_grant_revisions` (`organization_id`, `actor_id`, `status`);
--> statement-breakpoint

CREATE TABLE `compliance_export_grant_current` (
	`organization_id` text NOT NULL,
	`actor_membership_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`authority_version` text DEFAULT 'compliance-export-authority.v1' NOT NULL,
	`grant_id` text NOT NULL,
	`grant_revision` integer NOT NULL,
	`pointer_version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `actor_id`, `authority_version`),
	FOREIGN KEY (`organization_id`, `actor_membership_id`, `actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `grant_id`, `grant_revision`, `actor_membership_id`, `actor_id`, `authority_version`) REFERENCES `compliance_export_grant_revisions`(`organization_id`, `grant_id`, `grant_revision`, `actor_membership_id`, `actor_id`, `authority_version`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `compliance_export_grant_current_authority_check` CHECK(`authority_version` = 'compliance-export-authority.v1'),
	CONSTRAINT `compliance_export_grant_current_versions_check` CHECK(`grant_revision` >= 1 AND `pointer_version` >= 1)
);
--> statement-breakpoint

CREATE TABLE `tenant_export_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`requester_membership_id` text NOT NULL,
	`requester_actor_id` text NOT NULL,
	`grant_id` text NOT NULL,
	`grant_revision` integer NOT NULL,
	`export_manifest_sha256` text NOT NULL,
	`expected_dossier_count` integer NOT NULL,
	`request_receipt_sha256` text NOT NULL,
	`requested_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`organization_id`, `requester_membership_id`, `requester_actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `grant_id`, `grant_revision`) REFERENCES `compliance_export_grant_revisions`(`organization_id`, `grant_id`, `grant_revision`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_export_requests_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_export_requests_actor_id_check` CHECK(length(`requester_actor_id`) BETWEEN 20 AND 128 AND `requester_actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_export_requests_grant_revision_check` CHECK(`grant_revision` >= 1),
	CONSTRAINT `tenant_export_requests_manifest_check` CHECK(length(`export_manifest_sha256`) = 64 AND `export_manifest_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_export_requests_count_check` CHECK(`expected_dossier_count` >= 1),
	CONSTRAINT `tenant_export_requests_receipt_check` CHECK(length(`request_receipt_sha256`) = 64 AND `request_receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_export_requests_expiry_check` CHECK(julianday(`requested_at`) IS NOT NULL AND julianday(`expires_at`) IS NOT NULL AND julianday(`expires_at`) > julianday(`requested_at`)),
	UNIQUE (`organization_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_export_requests_receipt_uidx` ON `tenant_export_requests` (`request_receipt_sha256`);
--> statement-breakpoint
CREATE INDEX `tenant_export_requests_org_requested_idx` ON `tenant_export_requests` (`organization_id`, `requested_at`);
--> statement-breakpoint

CREATE TABLE `tenant_export_request_dossiers` (
	`organization_id` text NOT NULL,
	`export_request_id` text NOT NULL,
	`dossier_id` text NOT NULL,
	`dossier_ordinal` integer NOT NULL,
	`dossier_manifest_sha256` text NOT NULL,
	`dossier_owner_membership_id` text NOT NULL,
	`dossier_owner_actor_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `export_request_id`, `dossier_id`),
	FOREIGN KEY (`organization_id`, `export_request_id`) REFERENCES `tenant_export_requests`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `dossier_owner_membership_id`, `dossier_owner_actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_export_request_dossiers_id_check` CHECK(length(`dossier_id`) BETWEEN 20 AND 128 AND `dossier_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_export_request_dossiers_ordinal_check` CHECK(`dossier_ordinal` >= 1),
	CONSTRAINT `tenant_export_request_dossiers_manifest_check` CHECK(length(`dossier_manifest_sha256`) = 64 AND `dossier_manifest_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_export_request_dossiers_actor_check` CHECK(length(`dossier_owner_actor_id`) BETWEEN 20 AND 128 AND `dossier_owner_actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	UNIQUE (`organization_id`, `export_request_id`, `dossier_ordinal`),
	UNIQUE (`organization_id`, `export_request_id`, `dossier_id`, `dossier_manifest_sha256`, `dossier_owner_membership_id`, `dossier_owner_actor_id`)
);
--> statement-breakpoint

CREATE TABLE `tenant_export_approval_records` (
	`organization_id` text NOT NULL,
	`export_request_id` text NOT NULL,
	`dossier_id` text NOT NULL,
	`approval_version` text DEFAULT 'dossier-export-approval.v1' NOT NULL,
	`dossier_owner_membership_id` text NOT NULL,
	`dossier_owner_actor_id` text NOT NULL,
	`approval_receipt_id` text NOT NULL,
	`dossier_manifest_sha256` text NOT NULL,
	`approved_at` text NOT NULL,
	PRIMARY KEY (`organization_id`, `export_request_id`, `dossier_id`),
	FOREIGN KEY (`organization_id`, `export_request_id`, `dossier_id`, `dossier_manifest_sha256`, `dossier_owner_membership_id`, `dossier_owner_actor_id`) REFERENCES `tenant_export_request_dossiers`(`organization_id`, `export_request_id`, `dossier_id`, `dossier_manifest_sha256`, `dossier_owner_membership_id`, `dossier_owner_actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `approval_receipt_id`) REFERENCES `organization_security_receipts`(`organization_id`, `receipt_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_export_approvals_dossier_id_check` CHECK(length(`dossier_id`) BETWEEN 20 AND 128 AND `dossier_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_export_approvals_version_check` CHECK(`approval_version` = 'dossier-export-approval.v1'),
	CONSTRAINT `tenant_export_approvals_actor_id_check` CHECK(length(`dossier_owner_actor_id`) BETWEEN 20 AND 128 AND `dossier_owner_actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_export_approvals_receipt_id_check` CHECK(length(`approval_receipt_id`) BETWEEN 20 AND 128 AND `approval_receipt_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_export_approvals_manifest_check` CHECK(length(`dossier_manifest_sha256`) = 64 AND `dossier_manifest_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_export_approvals_time_check` CHECK(julianday(`approved_at`) IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_export_approvals_receipt_uidx` ON `tenant_export_approval_records` (`organization_id`, `approval_receipt_id`);
--> statement-breakpoint

CREATE TABLE `tenant_export_request_state` (
	`organization_id` text NOT NULL,
	`export_request_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`authorization_version` integer DEFAULT 1 NOT NULL,
	`approval_set_sha256` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `export_request_id`),
	FOREIGN KEY (`organization_id`, `export_request_id`) REFERENCES `tenant_export_requests`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_export_request_state_status_check` CHECK(`status` IN ('pending', 'approved', 'rejected', 'expired', 'consumed')),
	CONSTRAINT `tenant_export_request_state_version_check` CHECK(`authorization_version` >= 1),
	CONSTRAINT `tenant_export_request_state_approval_check` CHECK((`status` IN ('approved', 'consumed') AND length(`approval_set_sha256`) = 64 AND `approval_set_sha256` NOT GLOB '*[^0-9a-f]*') OR (`status` NOT IN ('approved', 'consumed') AND `approval_set_sha256` IS NULL))
);
--> statement-breakpoint
CREATE INDEX `tenant_export_request_state_status_idx` ON `tenant_export_request_state` (`organization_id`, `status`, `updated_at`);
--> statement-breakpoint

CREATE TABLE `tenant_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`identity_connection_id` text,
	`authentication_method` text NOT NULL,
	`session_token_sha256` text NOT NULL,
	`organization_authorization_version` integer NOT NULL,
	`membership_authorization_version` integer NOT NULL,
	`policy_revision` integer NOT NULL,
	`identity_configuration_version` integer,
	`session_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`organization_id`, `membership_id`, `actor_id`) REFERENCES `organization_memberships`(`organization_id`, `id`, `actor_id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `identity_connection_id`) REFERENCES `organization_identity_connections`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `policy_revision`) REFERENCES `organization_policy_versions`(`organization_id`, `policy_revision`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `tenant_sessions_id_check` CHECK(length(`id`) BETWEEN 20 AND 128 AND `id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_sessions_actor_id_check` CHECK(length(`actor_id`) BETWEEN 20 AND 128 AND `actor_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `tenant_sessions_method_check` CHECK(`authentication_method` IN ('local', 'chatgpt', 'entra_oidc')),
	CONSTRAINT `tenant_sessions_token_check` CHECK(length(`session_token_sha256`) = 64 AND `session_token_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `tenant_sessions_versions_check` CHECK(`organization_authorization_version` >= 1 AND `membership_authorization_version` >= 1 AND `policy_revision` >= 1 AND `session_version` >= 1 AND (`identity_configuration_version` IS NULL OR `identity_configuration_version` >= 1)),
	CONSTRAINT `tenant_sessions_identity_shape_check` CHECK((`authentication_method` = 'entra_oidc' AND `identity_connection_id` IS NOT NULL AND `identity_configuration_version` IS NOT NULL) OR (`authentication_method` <> 'entra_oidc' AND `identity_connection_id` IS NULL AND `identity_configuration_version` IS NULL)),
	CONSTRAINT `tenant_sessions_status_check` CHECK(`status` IN ('active', 'revoked', 'expired')),
	CONSTRAINT `tenant_sessions_revocation_shape_check` CHECK((`status` = 'revoked' AND julianday(`revoked_at`) IS NOT NULL AND julianday(`revoked_at`) >= julianday(`issued_at`)) OR (`status` <> 'revoked' AND `revoked_at` IS NULL)),
	CONSTRAINT `tenant_sessions_time_check` CHECK(julianday(`issued_at`) IS NOT NULL AND julianday(`expires_at`) IS NOT NULL AND julianday(`last_seen_at`) IS NOT NULL AND julianday(`expires_at`) > julianday(`issued_at`) AND julianday(`last_seen_at`) >= julianday(`issued_at`) AND julianday(`last_seen_at`) <= julianday(`expires_at`)),
	UNIQUE (`organization_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_sessions_token_uidx` ON `tenant_sessions` (`session_token_sha256`);
--> statement-breakpoint
CREATE INDEX `tenant_sessions_membership_status_idx` ON `tenant_sessions` (`organization_id`, `membership_id`, `status`, `expires_at`);
--> statement-breakpoint

CREATE TABLE `organization_key_rotation_state` (
	`organization_id` text NOT NULL,
	`purpose` text NOT NULL,
	`key_alias` text NOT NULL,
	`current_version` integer NOT NULL,
	`from_version` integer,
	`to_version` integer,
	`write_version` integer NOT NULL,
	`read_version_primary` integer NOT NULL,
	`read_version_secondary` integer,
	`phase` text DEFAULT 'stable' NOT NULL,
	`rewrap_total_count` integer DEFAULT 0 NOT NULL,
	`rewrapped_count` integer DEFAULT 0 NOT NULL,
	`rewrap_checkpoint_sha256` text,
	`new_version_write_count` integer DEFAULT 0 NOT NULL,
	`rollback_total_new_version_writes` integer,
	`rollback_rewrapped_new_version_writes` integer,
	`rollback_pending_new_version_writes` integer,
	`verification_receipt_sha256` text,
	`rollback_verification_receipt_sha256` text,
	`rotation_version` integer DEFAULT 1 NOT NULL,
	`state_receipt_sha256` text NOT NULL,
	`activated_at` text NOT NULL,
	`rotate_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY (`organization_id`, `purpose`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_key_rotation_purpose_check` CHECK(`purpose` IN ('live_data', 'exports', 'backups', 'restore')),
	CONSTRAINT `organization_key_rotation_alias_check` CHECK(`key_alias` NOT GLOB '*[^A-Za-z0-9/_-]*' AND ((`purpose` = 'live_data' AND length(`key_alias`) BETWEEN 8 AND 160 AND `key_alias` GLOB 'live/*') OR (`purpose` = 'exports' AND length(`key_alias`) BETWEEN 10 AND 160 AND `key_alias` GLOB 'export/*') OR (`purpose` = 'backups' AND length(`key_alias`) BETWEEN 10 AND 160 AND `key_alias` GLOB 'backup/*') OR (`purpose` = 'restore' AND length(`key_alias`) BETWEEN 11 AND 160 AND `key_alias` GLOB 'restore/*'))),
	CONSTRAINT `organization_key_rotation_versions_check` CHECK(`current_version` >= 1 AND `write_version` >= 1 AND `read_version_primary` >= 1 AND (`read_version_secondary` IS NULL OR `read_version_secondary` >= 1) AND (`from_version` IS NULL OR `from_version` >= 1) AND (`to_version` IS NULL OR `to_version` >= 2) AND `rotation_version` >= 1),
	CONSTRAINT `organization_key_rotation_phase_check` CHECK(`phase` IN ('stable', 'preparing', 'rewrapping', 'verifying', 'rollback_rewrapping', 'rollback_verifying', 'completed', 'rolled_back')),
	CONSTRAINT `organization_key_rotation_progress_check` CHECK(`rewrap_total_count` >= 0 AND `rewrapped_count` BETWEEN 0 AND `rewrap_total_count` AND `new_version_write_count` >= 0 AND (`rewrap_checkpoint_sha256` IS NULL OR (length(`rewrap_checkpoint_sha256`) = 64 AND `rewrap_checkpoint_sha256` NOT GLOB '*[^0-9a-f]*')) AND (`rollback_total_new_version_writes` IS NULL OR `rollback_total_new_version_writes` >= 0) AND (`rollback_rewrapped_new_version_writes` IS NULL OR `rollback_rewrapped_new_version_writes` >= 0) AND (`rollback_pending_new_version_writes` IS NULL OR `rollback_pending_new_version_writes` >= 0)),
	CONSTRAINT `organization_key_rotation_receipt_check` CHECK(length(`state_receipt_sha256`) = 64 AND `state_receipt_sha256` NOT GLOB '*[^0-9a-f]*' AND (`verification_receipt_sha256` IS NULL OR (length(`verification_receipt_sha256`) = 64 AND `verification_receipt_sha256` NOT GLOB '*[^0-9a-f]*')) AND (`rollback_verification_receipt_sha256` IS NULL OR (length(`rollback_verification_receipt_sha256`) = 64 AND `rollback_verification_receipt_sha256` NOT GLOB '*[^0-9a-f]*'))),
	CONSTRAINT `organization_key_rotation_nullable_shape_check` CHECK(
		(`phase` IN ('stable', 'completed') AND `from_version` IS NULL AND `to_version` IS NULL AND `read_version_secondary` IS NULL)
		OR (`phase` = 'preparing' AND `from_version` IS NOT NULL AND `to_version` IS NOT NULL AND `read_version_secondary` IS NULL)
		OR (`phase` IN ('rewrapping', 'verifying', 'rollback_rewrapping', 'rollback_verifying') AND `from_version` IS NOT NULL AND `to_version` IS NOT NULL AND `read_version_secondary` IS NOT NULL)
		OR (`phase` = 'rolled_back' AND `from_version` IS NOT NULL AND `to_version` IS NOT NULL AND `read_version_secondary` IS NULL)
	),
	CONSTRAINT `organization_key_rotation_rollback_progress_shape_check` CHECK(
		(`phase` IN ('rollback_rewrapping', 'rollback_verifying') AND `rollback_total_new_version_writes` IS NOT NULL AND `rollback_rewrapped_new_version_writes` IS NOT NULL AND `rollback_pending_new_version_writes` IS NOT NULL)
		OR (`phase` = 'rolled_back' AND `new_version_write_count` > 0 AND `rollback_total_new_version_writes` = `new_version_write_count` AND `rollback_rewrapped_new_version_writes` = `rollback_total_new_version_writes` AND `rollback_pending_new_version_writes` = 0)
		OR (`phase` = 'rolled_back' AND `new_version_write_count` = 0 AND `rollback_total_new_version_writes` IS NULL AND `rollback_rewrapped_new_version_writes` IS NULL AND `rollback_pending_new_version_writes` IS NULL)
		OR (`phase` NOT IN ('rollback_rewrapping', 'rollback_verifying', 'rolled_back') AND `rollback_total_new_version_writes` IS NULL AND `rollback_rewrapped_new_version_writes` IS NULL AND `rollback_pending_new_version_writes` IS NULL)
	),
	CONSTRAINT `organization_key_rotation_state_shape_check` CHECK(
		(`phase` = 'stable' AND `from_version` IS NULL AND `to_version` IS NULL AND `write_version` = `current_version` AND `read_version_primary` = `current_version` AND `read_version_secondary` IS NULL AND `rewrap_total_count` = 0 AND `rewrapped_count` = 0 AND `new_version_write_count` = 0 AND `rollback_total_new_version_writes` IS NULL AND `rollback_rewrapped_new_version_writes` IS NULL AND `rollback_pending_new_version_writes` IS NULL AND `verification_receipt_sha256` IS NULL AND `rollback_verification_receipt_sha256` IS NULL)
		OR (`phase` = 'preparing' AND `current_version` = `from_version` AND `to_version` = `from_version` + 1 AND `write_version` = `from_version` AND `read_version_primary` = `from_version` AND `read_version_secondary` IS NULL AND `rewrapped_count` = 0 AND `new_version_write_count` = 0 AND `rollback_total_new_version_writes` IS NULL AND `verification_receipt_sha256` IS NULL AND `rollback_verification_receipt_sha256` IS NULL)
		OR (`phase` IN ('rewrapping', 'verifying') AND `current_version` = `from_version` AND `to_version` = `from_version` + 1 AND `write_version` = `to_version` AND `read_version_primary` = `from_version` AND `read_version_secondary` = `to_version` AND (`phase` <> 'verifying' OR `rewrapped_count` = `rewrap_total_count`) AND `rollback_total_new_version_writes` IS NULL AND `verification_receipt_sha256` IS NULL AND `rollback_verification_receipt_sha256` IS NULL)
		OR (`phase` IN ('rollback_rewrapping', 'rollback_verifying') AND `current_version` = `from_version` AND `to_version` = `from_version` + 1 AND `write_version` = `from_version` AND `read_version_primary` = `from_version` AND `read_version_secondary` = `to_version` AND `rollback_total_new_version_writes` = `new_version_write_count` AND `rollback_rewrapped_new_version_writes` + `rollback_pending_new_version_writes` = `rollback_total_new_version_writes` AND (`phase` <> 'rollback_verifying' OR (`rollback_pending_new_version_writes` = 0 AND `rollback_verification_receipt_sha256` IS NOT NULL)) AND `verification_receipt_sha256` IS NULL)
		OR (`phase` = 'completed' AND `from_version` IS NULL AND `to_version` IS NULL AND `write_version` = `current_version` AND `read_version_primary` = `current_version` AND `read_version_secondary` IS NULL AND `rewrapped_count` = `rewrap_total_count` AND `verification_receipt_sha256` IS NOT NULL AND `rollback_total_new_version_writes` IS NULL AND `rollback_verification_receipt_sha256` IS NULL)
		OR (`phase` = 'rolled_back' AND `current_version` = `from_version` AND `to_version` = `from_version` + 1 AND `write_version` = `from_version` AND `read_version_primary` = `from_version` AND `read_version_secondary` IS NULL AND `verification_receipt_sha256` IS NULL AND ((`new_version_write_count` = 0 AND `rollback_verification_receipt_sha256` IS NULL) OR (`new_version_write_count` > 0 AND `rollback_pending_new_version_writes` = 0 AND `rollback_verification_receipt_sha256` IS NOT NULL)))
	),
	CONSTRAINT `organization_key_rotation_time_check` CHECK(julianday(`activated_at`) IS NOT NULL AND julianday(`rotate_by`) IS NOT NULL AND julianday(`rotate_by`) > julianday(`activated_at`))
);
--> statement-breakpoint
CREATE INDEX `organization_key_rotation_due_idx` ON `organization_key_rotation_state` (`phase`, `rotate_by`);
--> statement-breakpoint

CREATE TABLE `organization_security_receipts` (
	`organization_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`receipt_id` text NOT NULL,
	`receipt_version` text DEFAULT 'security-receipt.v1' NOT NULL,
	`event_type` text NOT NULL,
	`evidence_status` text DEFAULT 'complete' NOT NULL,
	`outcome` text NOT NULL,
	`actor_id` text NOT NULL,
	`session_id` text,
	`authentication_method` text NOT NULL,
	`request_class` text NOT NULL,
	`scope` text NOT NULL,
	`dossier_id` text,
	`action` text NOT NULL,
	`policy_version` text NOT NULL,
	`organization_authorization_version` integer,
	`membership_authorization_version` integer,
	`participant_authorization_version` integer,
	`policy_revision` integer,
	`identity_configuration_version` integer,
	`resource_revision` integer NOT NULL,
	`tenant_manifest_revision` integer,
	`request_correlation_sha256` text NOT NULL,
	`idempotency_correlation_sha256` text,
	`resource_digest_sha256` text,
	`reason_code` text NOT NULL,
	`reviewer_actor_id` text,
	`deployment_sha` text NOT NULL,
	`environment` text NOT NULL,
	`previous_receipt_sha256` text NOT NULL,
	`receipt_sha256` text NOT NULL,
	`occurred_at` text NOT NULL,
	PRIMARY KEY (`organization_id`, `sequence`),
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	FOREIGN KEY (`organization_id`, `session_id`) REFERENCES `tenant_sessions`(`organization_id`, `id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
	CONSTRAINT `organization_security_receipts_sequence_check` CHECK(`sequence` >= 1),
	CONSTRAINT `organization_security_receipts_id_check` CHECK(length(`receipt_id`) BETWEEN 20 AND 128 AND `receipt_id` NOT GLOB '*[^A-Za-z0-9_-]*'),
	CONSTRAINT `organization_security_receipts_version_check` CHECK(`receipt_version` = 'security-receipt.v1'),
	CONSTRAINT `organization_security_receipts_event_check` CHECK(`event_type` IN ('authorization_decision', 'invitation_event', 'key_rotation_event', 'security_transition')),
	CONSTRAINT `organization_security_receipts_evidence_check` CHECK(`evidence_status` IN ('complete', 'incomplete')),
	CONSTRAINT `organization_security_receipts_outcome_check` CHECK(`outcome` IN ('allowed', 'denied')),
	CONSTRAINT `organization_security_receipts_actor_check` CHECK(length(`actor_id`) BETWEEN 20 AND 128 AND `actor_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND (`reviewer_actor_id` IS NULL OR (length(`reviewer_actor_id`) BETWEEN 20 AND 128 AND `reviewer_actor_id` NOT GLOB '*[^A-Za-z0-9_-]*' AND `reviewer_actor_id` <> `actor_id`))),
	CONSTRAINT `organization_security_receipts_authentication_check` CHECK(`authentication_method` IN ('entra_oidc', 'session_cookie', 'invitation_token', 'local_test')),
	CONSTRAINT `organization_security_receipts_scope_check` CHECK(`request_class` IN ('identity', 'organization', 'dossier', 'compliance_export', 'security') AND `scope` IN ('identity', 'organization', 'dossier') AND ((`scope` = 'dossier' AND length(`dossier_id`) BETWEEN 20 AND 128 AND `dossier_id` NOT GLOB '*[^A-Za-z0-9_-]*') OR (`scope` <> 'dossier' AND `dossier_id` IS NULL))),
	CONSTRAINT `organization_security_receipts_action_check` CHECK(length(`action`) BETWEEN 1 AND 128 AND `action` NOT GLOB '*[^A-Za-z0-9._:-]*'),
	CONSTRAINT `organization_security_receipts_policy_check` CHECK(length(`policy_version`) BETWEEN 1 AND 64 AND `policy_version` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_security_receipts_versions_check` CHECK((`organization_authorization_version` IS NULL OR `organization_authorization_version` >= 1) AND (`membership_authorization_version` IS NULL OR `membership_authorization_version` >= 1) AND (`participant_authorization_version` IS NULL OR `participant_authorization_version` >= 1) AND (`policy_revision` IS NULL OR `policy_revision` >= 1) AND (`identity_configuration_version` IS NULL OR `identity_configuration_version` >= 1) AND `resource_revision` >= 1 AND (`tenant_manifest_revision` IS NULL OR `tenant_manifest_revision` >= 1)),
	CONSTRAINT `organization_security_receipts_correlation_check` CHECK(length(`request_correlation_sha256`) = 64 AND `request_correlation_sha256` NOT GLOB '*[^0-9a-f]*' AND (`idempotency_correlation_sha256` IS NULL OR (length(`idempotency_correlation_sha256`) = 64 AND `idempotency_correlation_sha256` NOT GLOB '*[^0-9a-f]*'))),
	CONSTRAINT `organization_security_receipts_resource_check` CHECK(`resource_digest_sha256` IS NULL OR (length(`resource_digest_sha256`) = 64 AND `resource_digest_sha256` NOT GLOB '*[^0-9a-f]*')),
	CONSTRAINT `organization_security_receipts_reason_check` CHECK(length(`reason_code`) BETWEEN 1 AND 96 AND `reason_code` NOT GLOB '*[^A-Za-z0-9._-]*'),
	CONSTRAINT `organization_security_receipts_deployment_check` CHECK(length(`deployment_sha`) = 40 AND `deployment_sha` NOT GLOB '*[^0-9a-f]*' AND `environment` IN ('development', 'validation', 'production')),
	CONSTRAINT `organization_security_receipts_previous_check` CHECK(length(`previous_receipt_sha256`) = 64 AND `previous_receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_security_receipts_digest_check` CHECK(length(`receipt_sha256`) = 64 AND `receipt_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT `organization_security_receipts_occurred_at_check` CHECK(julianday(`occurred_at`) IS NOT NULL),
	UNIQUE (`organization_id`, `receipt_id`),
	UNIQUE (`organization_id`, `receipt_sha256`)
);
--> statement-breakpoint
CREATE INDEX `organization_security_receipts_event_idx` ON `organization_security_receipts` (`organization_id`, `event_type`, `occurred_at`);
--> statement-breakpoint
CREATE INDEX `organization_security_receipts_actor_idx` ON `organization_security_receipts` (`organization_id`, `actor_id`, `occurred_at`);
--> statement-breakpoint

CREATE TRIGGER `organizations_insert_guard`
BEFORE INSERT ON `organizations`
FOR EACH ROW
WHEN NEW.`status` <> 'provisioning' OR NEW.`authorization_version` <> 1 OR NEW.`configuration_version` <> 1 OR NEW.`confidential_document_mode_version` <> 1 OR NEW.`confidential_document_mode` <> 'disabled'
BEGIN
	SELECT RAISE(ABORT, 'organizations must begin at provisioning and version one');
END;
--> statement-breakpoint
CREATE TRIGGER `organizations_identity_guard`
BEFORE UPDATE ON `organizations`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id` OR NEW.`created_at` IS NOT OLD.`created_at` OR NEW.`data_region` IS NOT OLD.`data_region`
BEGIN
	SELECT RAISE(ABORT, 'organization identity and region are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `organizations_lifecycle_guard`
BEFORE UPDATE OF `status`, `authorization_version` ON `organizations`
FOR EACH ROW
WHEN (NEW.`status` IS OLD.`status` AND NEW.`authorization_version` <> OLD.`authorization_version`)
	OR (NEW.`status` IS NOT OLD.`status` AND (NEW.`authorization_version` <> OLD.`authorization_version` + 1 OR NOT EXISTS (
		SELECT 1 FROM `organization_lifecycle_transitions` AS transition
		WHERE transition.`organization_id` = OLD.`id`
			AND transition.`transition_version` = NEW.`authorization_version`
			AND transition.`from_status` = OLD.`status`
			AND transition.`to_status` = NEW.`status`
	)))
BEGIN
	SELECT RAISE(ABORT, 'organization lifecycle changes require an exact immutable transition');
END;
--> statement-breakpoint
CREATE TRIGGER `organizations_configuration_guard`
BEFORE UPDATE ON `organizations`
FOR EACH ROW
WHEN ((NEW.`display_name` IS NOT OLD.`display_name` OR NEW.`slug` IS NOT OLD.`slug` OR NEW.`controller_processor_mode` IS NOT OLD.`controller_processor_mode` OR NEW.`suspension_reason` IS NOT OLD.`suspension_reason`) AND NEW.`configuration_version` <> OLD.`configuration_version` + 1)
	OR ((NEW.`display_name` IS OLD.`display_name` AND NEW.`slug` IS OLD.`slug` AND NEW.`controller_processor_mode` IS OLD.`controller_processor_mode` AND NEW.`suspension_reason` IS OLD.`suspension_reason`) AND NEW.`configuration_version` <> OLD.`configuration_version`)
	OR NEW.`configuration_version` < OLD.`configuration_version`
BEGIN
	SELECT RAISE(ABORT, 'organization configuration changes require one monotonic version step');
END;
--> statement-breakpoint
CREATE TRIGGER `organizations_confidential_mode_guard`
BEFORE UPDATE OF `confidential_document_mode`, `confidential_document_mode_version` ON `organizations`
FOR EACH ROW
WHEN (NEW.`confidential_document_mode` IS NOT OLD.`confidential_document_mode` AND NEW.`confidential_document_mode_version` <> OLD.`confidential_document_mode_version` + 1)
	OR (NEW.`confidential_document_mode` IS OLD.`confidential_document_mode` AND NEW.`confidential_document_mode_version` <> OLD.`confidential_document_mode_version`)
	OR NEW.`confidential_document_mode` = 'approved'
BEGIN
	SELECT RAISE(ABORT, 'confidential capability changes require one server-owned version step');
END;
--> statement-breakpoint
CREATE TRIGGER `organizations_delete_guard` BEFORE DELETE ON `organizations` BEGIN SELECT RAISE(ABORT, 'organizations cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_lifecycle_insert_guard`
BEFORE INSERT ON `organization_lifecycle_transitions`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `organizations` AS organization
	WHERE organization.`id` = NEW.`organization_id`
		AND organization.`status` = NEW.`from_status`
		AND organization.`authorization_version` + 1 = NEW.`transition_version`
)
OR NOT (
	(NEW.`from_status` = 'provisioning' AND NEW.`to_status` = 'active')
	OR (NEW.`from_status` = 'active' AND NEW.`to_status` IN ('suspended', 'closing'))
	OR (NEW.`from_status` = 'suspended' AND NEW.`to_status` IN ('active', 'closing'))
	OR (NEW.`from_status` = 'closing' AND NEW.`to_status` = 'closed')
)
	OR EXISTS (
		SELECT 1 FROM `organization_lifecycle_transitions` AS previous
		WHERE previous.`organization_id` = NEW.`organization_id`
			AND previous.`transition_version` = NEW.`transition_version` - 1
			AND julianday(NEW.`occurred_at`) < julianday(previous.`occurred_at`)
	)
BEGIN
	SELECT RAISE(ABORT, 'organization lifecycle transition is stale or not allowlisted');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_lifecycle_apply`
AFTER INSERT ON `organization_lifecycle_transitions`
FOR EACH ROW
BEGIN
	UPDATE `organizations`
	SET `status` = NEW.`to_status`,
		`authorization_version` = NEW.`transition_version`,
		`updated_at` = NEW.`occurred_at`
	WHERE `id` = NEW.`organization_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `organization_lifecycle_update_guard` BEFORE UPDATE ON `organization_lifecycle_transitions` BEGIN SELECT RAISE(ABORT, 'organization lifecycle evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `organization_lifecycle_delete_guard` BEFORE DELETE ON `organization_lifecycle_transitions` BEGIN SELECT RAISE(ABORT, 'organization lifecycle evidence is append-only'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_identity_connections_insert_guard`
BEFORE INSERT ON `organization_identity_connections`
FOR EACH ROW
WHEN NEW.`status` <> 'pending_consent' OR NEW.`configuration_version` <> 1
BEGIN
	SELECT RAISE(ABORT, 'identity connections must begin pending consent at configuration version one');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_identity_connections_update_guard`
BEFORE UPDATE ON `organization_identity_connections`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id` OR NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`provider` IS NOT OLD.`provider` OR NEW.`created_at` IS NOT OLD.`created_at`
	OR NEW.`configuration_version` <> OLD.`configuration_version` + 1
	OR NOT ((OLD.`status` = NEW.`status`) OR (OLD.`status` = 'pending_consent' AND NEW.`status` IN ('active', 'suspended', 'revoked')) OR (OLD.`status` = 'active' AND NEW.`status` IN ('suspended', 'revoked')) OR (OLD.`status` = 'suspended' AND NEW.`status` IN ('active', 'revoked')))
BEGIN
	SELECT RAISE(ABORT, 'identity connection mutation is stale or not allowlisted');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_identity_connections_delete_guard` BEFORE DELETE ON `organization_identity_connections` BEGIN SELECT RAISE(ABORT, 'identity connection evidence cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_memberships_insert_guard`
BEFORE INSERT ON `organization_memberships`
FOR EACH ROW
WHEN NEW.`status` <> 'active' OR NEW.`authorization_version` <> 1 OR NOT EXISTS (SELECT 1 FROM `organizations` WHERE `id` = NEW.`organization_id` AND `status` IN ('provisioning', 'active'))
	OR EXISTS (SELECT 1 FROM `organization_memberships` WHERE `actor_id` = NEW.`actor_id` AND `user_id` <> NEW.`user_id`)
BEGIN
	SELECT RAISE(ABORT, 'memberships require an available organization and begin active at version one');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_memberships_update_guard`
BEFORE UPDATE ON `organization_memberships`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id` OR NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`user_id` IS NOT OLD.`user_id` OR NEW.`actor_id` IS NOT OLD.`actor_id` OR NEW.`created_at` IS NOT OLD.`created_at`
	OR NEW.`authorization_version` <> OLD.`authorization_version` + 1
	OR NOT ((OLD.`status` = NEW.`status`) OR (OLD.`status` = 'active' AND NEW.`status` IN ('suspended', 'removed')) OR (OLD.`status` = 'suspended' AND NEW.`status` IN ('active', 'removed')))
BEGIN
	SELECT RAISE(ABORT, 'membership mutation is stale or not allowlisted');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_memberships_delete_guard` BEFORE DELETE ON `organization_memberships` BEGIN SELECT RAISE(ABORT, 'membership evidence cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_invitations_insert_guard`
BEFORE INSERT ON `organization_invitations`
FOR EACH ROW
WHEN NEW.`status` <> 'active' OR NEW.`authorization_version` <> 1
	OR NOT EXISTS (SELECT 1 FROM `organizations` WHERE `id` = NEW.`organization_id` AND `status` = 'active')
	OR NOT EXISTS (SELECT 1 FROM `organization_memberships` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`invited_by_membership_id` AND `status` = 'active')
BEGIN
	SELECT RAISE(ABORT, 'invitations require active organization authority and begin active');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_invitations_update_guard`
BEFORE UPDATE ON `organization_invitations`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id` OR NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`invited_by_membership_id` IS NOT OLD.`invited_by_membership_id` OR NEW.`intended_role` IS NOT OLD.`intended_role` OR NEW.`intended_identity_issuer` IS NOT OLD.`intended_identity_issuer` OR NEW.`intended_identity_tenant_id` IS NOT OLD.`intended_identity_tenant_id` OR NEW.`intended_identity_subject` IS NOT OLD.`intended_identity_subject` OR NEW.`exact_origin` IS NOT OLD.`exact_origin` OR NEW.`token_sha256` IS NOT OLD.`token_sha256` OR NEW.`delivery_address_hmac_sha256` IS NOT OLD.`delivery_address_hmac_sha256` OR NEW.`expires_at` IS NOT OLD.`expires_at` OR NEW.`created_at` IS NOT OLD.`created_at`
	OR NEW.`authorization_version` <> OLD.`authorization_version` + 1
	OR NOT (OLD.`status` = 'active' AND NEW.`status` IN ('accepted', 'revoked', 'expired'))
BEGIN
	SELECT RAISE(ABORT, 'invitation mutation is stale or not allowlisted');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_invitations_delete_guard` BEFORE DELETE ON `organization_invitations` BEGIN SELECT RAISE(ABORT, 'invitation evidence cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_policy_versions_insert_guard`
BEFORE INSERT ON `organization_policy_versions`
FOR EACH ROW
WHEN (NEW.`policy_revision` > 1 AND NOT EXISTS (SELECT 1 FROM `organization_policy_versions` WHERE `organization_id` = NEW.`organization_id` AND `policy_revision` = NEW.`policy_revision` - 1))
BEGIN
	SELECT RAISE(ABORT, 'policy revisions must be contiguous');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_policy_versions_update_guard` BEFORE UPDATE ON `organization_policy_versions` BEGIN SELECT RAISE(ABORT, 'policy revisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `organization_policy_versions_delete_guard` BEFORE DELETE ON `organization_policy_versions` BEGIN SELECT RAISE(ABORT, 'policy revisions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `organization_policy_current_insert_guard`
BEFORE INSERT ON `organization_policy_current`
FOR EACH ROW
WHEN NEW.`pointer_version` <> 1 OR NEW.`policy_revision` <> 1
BEGIN
	SELECT RAISE(ABORT, 'current policy pointer must begin at revision and version one');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_policy_current_update_guard`
BEFORE UPDATE ON `organization_policy_current`
FOR EACH ROW
WHEN NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`policy_revision` <= OLD.`policy_revision` OR NEW.`pointer_version` <> OLD.`pointer_version` + 1
BEGIN
	SELECT RAISE(ABORT, 'current policy pointer cannot regress or skip its version');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_policy_current_delete_guard` BEFORE DELETE ON `organization_policy_current` BEGIN SELECT RAISE(ABORT, 'current policy pointers cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `tenant_resource_manifests_insert_guard`
BEFORE INSERT ON `tenant_resource_manifests`
FOR EACH ROW
WHEN NEW.`activation` = 'approved'
	OR (NEW.`manifest_revision` > 1 AND NOT EXISTS (SELECT 1 FROM `tenant_resource_manifests` WHERE `organization_id` = NEW.`organization_id` AND `manifest_revision` = NEW.`manifest_revision` - 1))
	OR EXISTS (
		SELECT 1 FROM `tenant_resource_manifests` AS existing
		WHERE existing.`organization_id` <> NEW.`organization_id`
			AND (
				existing.`d1_database_id` IN (NEW.`d1_database_id`, NEW.`r2_quarantine_id`, NEW.`r2_clean_id`, NEW.`r2_extracted_text_id`, NEW.`r2_exports_id`, NEW.`r2_backups_id`)
				OR existing.`r2_quarantine_id` IN (NEW.`d1_database_id`, NEW.`r2_quarantine_id`, NEW.`r2_clean_id`, NEW.`r2_extracted_text_id`, NEW.`r2_exports_id`, NEW.`r2_backups_id`)
				OR existing.`r2_clean_id` IN (NEW.`d1_database_id`, NEW.`r2_quarantine_id`, NEW.`r2_clean_id`, NEW.`r2_extracted_text_id`, NEW.`r2_exports_id`, NEW.`r2_backups_id`)
				OR existing.`r2_extracted_text_id` IN (NEW.`d1_database_id`, NEW.`r2_quarantine_id`, NEW.`r2_clean_id`, NEW.`r2_extracted_text_id`, NEW.`r2_exports_id`, NEW.`r2_backups_id`)
				OR existing.`r2_exports_id` IN (NEW.`d1_database_id`, NEW.`r2_quarantine_id`, NEW.`r2_clean_id`, NEW.`r2_extracted_text_id`, NEW.`r2_exports_id`, NEW.`r2_backups_id`)
				OR existing.`r2_backups_id` IN (NEW.`d1_database_id`, NEW.`r2_quarantine_id`, NEW.`r2_clean_id`, NEW.`r2_extracted_text_id`, NEW.`r2_exports_id`, NEW.`r2_backups_id`)
				OR existing.`live_data_key_alias` IN (NEW.`live_data_key_alias`, NEW.`export_key_alias`, NEW.`backup_key_alias`, NEW.`restore_key_alias`)
				OR existing.`export_key_alias` IN (NEW.`live_data_key_alias`, NEW.`export_key_alias`, NEW.`backup_key_alias`, NEW.`restore_key_alias`)
				OR existing.`backup_key_alias` IN (NEW.`live_data_key_alias`, NEW.`export_key_alias`, NEW.`backup_key_alias`, NEW.`restore_key_alias`)
				OR existing.`restore_key_alias` IN (NEW.`live_data_key_alias`, NEW.`export_key_alias`, NEW.`backup_key_alias`, NEW.`restore_key_alias`)
			)
	)
BEGIN
	SELECT RAISE(ABORT, 'approved activation is blocked; revisions must be contiguous and resources tenant-exclusive');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifests_update_guard` BEFORE UPDATE ON `tenant_resource_manifests` BEGIN SELECT RAISE(ABORT, 'tenant resource manifests are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifests_delete_guard` BEFORE DELETE ON `tenant_resource_manifests` BEGIN SELECT RAISE(ABORT, 'tenant resource manifests are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifest_components_update_guard` BEFORE UPDATE ON `tenant_resource_manifest_components` BEGIN SELECT RAISE(ABORT, 'tenant resource component evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifest_components_delete_guard` BEFORE DELETE ON `tenant_resource_manifest_components` BEGIN SELECT RAISE(ABORT, 'tenant resource component evidence is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifest_current_insert_guard`
BEFORE INSERT ON `tenant_resource_manifest_current`
FOR EACH ROW
WHEN NEW.`pointer_version` <> 1
	OR NOT EXISTS (SELECT 1 FROM `tenant_resource_manifests` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`manifest_id` AND `manifest_revision` = NEW.`manifest_revision` AND `environment` = NEW.`environment` AND `activation` <> 'approved' AND julianday(`verified_at`) <= julianday('now') AND julianday(`verification_expires_at`) > julianday('now'))
	OR (SELECT count(*) FROM `tenant_resource_manifest_components` WHERE `organization_id` = NEW.`organization_id` AND `manifest_id` = NEW.`manifest_id` AND julianday(`verified_at`) <= julianday('now') AND julianday(`expires_at`) > julianday('now')) <> 12
BEGIN
	SELECT RAISE(ABORT, 'current manifest requires an exact complete non-approved evidence set');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifest_current_update_guard`
BEFORE UPDATE ON `tenant_resource_manifest_current`
FOR EACH ROW
WHEN NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`environment` IS NOT OLD.`environment` OR NEW.`manifest_revision` <= OLD.`manifest_revision` OR NEW.`pointer_version` <> OLD.`pointer_version` + 1
	OR NOT EXISTS (SELECT 1 FROM `tenant_resource_manifests` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`manifest_id` AND `manifest_revision` = NEW.`manifest_revision` AND `environment` = NEW.`environment` AND `activation` <> 'approved' AND julianday(`verified_at`) <= julianday('now') AND julianday(`verification_expires_at`) > julianday('now'))
	OR (SELECT count(*) FROM `tenant_resource_manifest_components` WHERE `organization_id` = NEW.`organization_id` AND `manifest_id` = NEW.`manifest_id` AND julianday(`verified_at`) <= julianday('now') AND julianday(`expires_at`) > julianday('now')) <> 12
BEGIN
	SELECT RAISE(ABORT, 'current manifest repoint is stale, incomplete, or activating');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_resource_manifest_current_delete_guard` BEFORE DELETE ON `tenant_resource_manifest_current` BEGIN SELECT RAISE(ABORT, 'current manifest pointers cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_action_grant_revisions_insert_guard`
BEFORE INSERT ON `organization_action_grant_revisions`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `organization_memberships` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`actor_membership_id` AND `actor_id` = NEW.`actor_id`)
	OR (NEW.`grant_revision` = 1 AND EXISTS (SELECT 1 FROM `organization_action_grant_revisions` WHERE `organization_id` = NEW.`organization_id` AND `actor_id` = NEW.`actor_id` AND `action` = NEW.`action`))
	OR (NEW.`grant_revision` > 1 AND NOT EXISTS (
	SELECT 1 FROM `organization_action_grant_revisions`
	WHERE `organization_id` = NEW.`organization_id` AND `grant_id` = NEW.`grant_id` AND `grant_revision` = NEW.`grant_revision` - 1 AND `actor_membership_id` = NEW.`actor_membership_id` AND `actor_id` = NEW.`actor_id` AND `action` = NEW.`action`
))
BEGIN
	SELECT RAISE(ABORT, 'organization grant revisions must be contiguous and retain their binding');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_action_grant_revisions_update_guard` BEFORE UPDATE ON `organization_action_grant_revisions` BEGIN SELECT RAISE(ABORT, 'organization grant revisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `organization_action_grant_revisions_delete_guard` BEFORE DELETE ON `organization_action_grant_revisions` BEGIN SELECT RAISE(ABORT, 'organization grant revisions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `organization_action_grant_current_insert_guard`
BEFORE INSERT ON `organization_action_grant_current`
FOR EACH ROW
WHEN NEW.`pointer_version` <> 1 OR NEW.`grant_revision` <> 1 OR NOT EXISTS (
	SELECT 1 FROM `organization_action_grant_revisions` AS grant_revision
	JOIN `organization_memberships` AS actor ON actor.`organization_id` = grant_revision.`organization_id` AND actor.`id` = grant_revision.`actor_membership_id` AND actor.`actor_id` = grant_revision.`actor_id`
	JOIN `organizations` AS organization ON organization.`id` = grant_revision.`organization_id`
	WHERE grant_revision.`organization_id` = NEW.`organization_id` AND grant_revision.`grant_id` = NEW.`grant_id` AND grant_revision.`grant_revision` = NEW.`grant_revision` AND grant_revision.`actor_membership_id` = NEW.`actor_membership_id` AND grant_revision.`actor_id` = NEW.`actor_id` AND grant_revision.`authority_version` = NEW.`authority_version` AND grant_revision.`action` = NEW.`action` AND grant_revision.`status` = 'active' AND actor.`status` = 'active' AND organization.`status` = 'active' AND julianday(grant_revision.`valid_from`) <= julianday('now') AND (grant_revision.`valid_until` IS NULL OR julianday(grant_revision.`valid_until`) > julianday('now'))
)
BEGIN
	SELECT RAISE(ABORT, 'current organization grant must resolve to exact active authority');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_action_grant_current_update_guard`
BEFORE UPDATE ON `organization_action_grant_current`
FOR EACH ROW
WHEN NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`actor_membership_id` IS NOT OLD.`actor_membership_id` OR NEW.`actor_id` IS NOT OLD.`actor_id` OR NEW.`authority_version` IS NOT OLD.`authority_version` OR NEW.`action` IS NOT OLD.`action` OR NEW.`pointer_version` <> OLD.`pointer_version` + 1
	OR NEW.`grant_id` IS NOT OLD.`grant_id` OR NEW.`grant_revision` <> OLD.`grant_revision` + 1
	OR NOT EXISTS (SELECT 1 FROM `organization_action_grant_revisions` WHERE `organization_id` = NEW.`organization_id` AND `grant_id` = NEW.`grant_id` AND `grant_revision` = NEW.`grant_revision` AND `actor_membership_id` = NEW.`actor_membership_id` AND `actor_id` = NEW.`actor_id` AND `authority_version` = NEW.`authority_version` AND `action` = NEW.`action`)
	OR (
		EXISTS (SELECT 1 FROM `organization_action_grant_revisions` WHERE `organization_id` = NEW.`organization_id` AND `grant_id` = NEW.`grant_id` AND `grant_revision` = NEW.`grant_revision` AND `status` = 'active')
		AND NOT EXISTS (
			SELECT 1 FROM `organization_action_grant_revisions` AS grant_revision
			JOIN `organization_memberships` AS actor ON actor.`organization_id` = grant_revision.`organization_id` AND actor.`id` = grant_revision.`actor_membership_id` AND actor.`actor_id` = grant_revision.`actor_id`
			JOIN `organizations` AS organization ON organization.`id` = grant_revision.`organization_id`
			WHERE grant_revision.`organization_id` = NEW.`organization_id` AND grant_revision.`grant_id` = NEW.`grant_id` AND grant_revision.`grant_revision` = NEW.`grant_revision` AND actor.`status` = 'active' AND organization.`status` = 'active' AND julianday(grant_revision.`valid_from`) <= julianday('now') AND (grant_revision.`valid_until` IS NULL OR julianday(grant_revision.`valid_until`) > julianday('now'))
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'current organization grant repoint is stale or invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_action_grant_current_delete_guard` BEFORE DELETE ON `organization_action_grant_current` BEGIN SELECT RAISE(ABORT, 'current organization grants cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `compliance_export_grant_revisions_insert_guard`
BEFORE INSERT ON `compliance_export_grant_revisions`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `organization_memberships` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`actor_membership_id` AND `actor_id` = NEW.`actor_id`)
	OR (NEW.`grant_revision` = 1 AND EXISTS (SELECT 1 FROM `compliance_export_grant_revisions` WHERE `organization_id` = NEW.`organization_id` AND `actor_id` = NEW.`actor_id`))
	OR (NEW.`grant_revision` > 1 AND NOT EXISTS (
	SELECT 1 FROM `compliance_export_grant_revisions`
	WHERE `organization_id` = NEW.`organization_id` AND `grant_id` = NEW.`grant_id` AND `grant_revision` = NEW.`grant_revision` - 1 AND `actor_membership_id` = NEW.`actor_membership_id` AND `actor_id` = NEW.`actor_id`
))
BEGIN
	SELECT RAISE(ABORT, 'compliance grant revisions must be contiguous and retain their binding');
END;
--> statement-breakpoint
CREATE TRIGGER `compliance_export_grant_revisions_update_guard` BEFORE UPDATE ON `compliance_export_grant_revisions` BEGIN SELECT RAISE(ABORT, 'compliance grant revisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `compliance_export_grant_revisions_delete_guard` BEFORE DELETE ON `compliance_export_grant_revisions` BEGIN SELECT RAISE(ABORT, 'compliance grant revisions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `compliance_export_grant_current_insert_guard`
BEFORE INSERT ON `compliance_export_grant_current`
FOR EACH ROW
WHEN NEW.`pointer_version` <> 1 OR NEW.`grant_revision` <> 1 OR NOT EXISTS (
	SELECT 1 FROM `compliance_export_grant_revisions` AS grant_revision
	JOIN `organization_memberships` AS actor ON actor.`organization_id` = grant_revision.`organization_id` AND actor.`id` = grant_revision.`actor_membership_id` AND actor.`actor_id` = grant_revision.`actor_id`
	JOIN `organizations` AS organization ON organization.`id` = grant_revision.`organization_id`
	WHERE grant_revision.`organization_id` = NEW.`organization_id` AND grant_revision.`grant_id` = NEW.`grant_id` AND grant_revision.`grant_revision` = NEW.`grant_revision` AND grant_revision.`actor_membership_id` = NEW.`actor_membership_id` AND grant_revision.`actor_id` = NEW.`actor_id` AND grant_revision.`authority_version` = NEW.`authority_version` AND grant_revision.`status` = 'active' AND actor.`status` = 'active' AND organization.`status` = 'active' AND julianday(grant_revision.`valid_from`) <= julianday('now') AND (grant_revision.`valid_until` IS NULL OR julianday(grant_revision.`valid_until`) > julianday('now'))
)
BEGIN
	SELECT RAISE(ABORT, 'current compliance grant must resolve to exact active authority');
END;
--> statement-breakpoint
CREATE TRIGGER `compliance_export_grant_current_update_guard`
BEFORE UPDATE ON `compliance_export_grant_current`
FOR EACH ROW
WHEN NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`actor_membership_id` IS NOT OLD.`actor_membership_id` OR NEW.`actor_id` IS NOT OLD.`actor_id` OR NEW.`authority_version` IS NOT OLD.`authority_version` OR NEW.`pointer_version` <> OLD.`pointer_version` + 1
	OR NEW.`grant_id` IS NOT OLD.`grant_id` OR NEW.`grant_revision` <> OLD.`grant_revision` + 1
	OR NOT EXISTS (SELECT 1 FROM `compliance_export_grant_revisions` WHERE `organization_id` = NEW.`organization_id` AND `grant_id` = NEW.`grant_id` AND `grant_revision` = NEW.`grant_revision` AND `actor_membership_id` = NEW.`actor_membership_id` AND `actor_id` = NEW.`actor_id` AND `authority_version` = NEW.`authority_version`)
	OR (
		EXISTS (SELECT 1 FROM `compliance_export_grant_revisions` WHERE `organization_id` = NEW.`organization_id` AND `grant_id` = NEW.`grant_id` AND `grant_revision` = NEW.`grant_revision` AND `status` = 'active')
		AND NOT EXISTS (
			SELECT 1 FROM `compliance_export_grant_revisions` AS grant_revision
			JOIN `organization_memberships` AS actor ON actor.`organization_id` = grant_revision.`organization_id` AND actor.`id` = grant_revision.`actor_membership_id` AND actor.`actor_id` = grant_revision.`actor_id`
			JOIN `organizations` AS organization ON organization.`id` = grant_revision.`organization_id`
			WHERE grant_revision.`organization_id` = NEW.`organization_id` AND grant_revision.`grant_id` = NEW.`grant_id` AND grant_revision.`grant_revision` = NEW.`grant_revision` AND actor.`status` = 'active' AND organization.`status` = 'active' AND julianday(grant_revision.`valid_from`) <= julianday('now') AND (grant_revision.`valid_until` IS NULL OR julianday(grant_revision.`valid_until`) > julianday('now'))
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'current compliance grant repoint is stale or invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `compliance_export_grant_current_delete_guard` BEFORE DELETE ON `compliance_export_grant_current` BEGIN SELECT RAISE(ABORT, 'current compliance grants cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `tenant_export_requests_insert_guard`
BEFORE INSERT ON `tenant_export_requests`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1 FROM `compliance_export_grant_revisions` AS grant_revision
	JOIN `compliance_export_grant_current` AS current_grant ON current_grant.`organization_id` = grant_revision.`organization_id` AND current_grant.`actor_id` = grant_revision.`actor_id` AND current_grant.`grant_id` = grant_revision.`grant_id` AND current_grant.`grant_revision` = grant_revision.`grant_revision`
	JOIN `organization_memberships` AS requester ON requester.`organization_id` = grant_revision.`organization_id` AND requester.`id` = grant_revision.`actor_membership_id` AND requester.`actor_id` = grant_revision.`actor_id`
	JOIN `organizations` AS organization ON organization.`id` = grant_revision.`organization_id`
	WHERE grant_revision.`organization_id` = NEW.`organization_id` AND grant_revision.`grant_id` = NEW.`grant_id` AND grant_revision.`grant_revision` = NEW.`grant_revision` AND grant_revision.`actor_membership_id` = NEW.`requester_membership_id` AND grant_revision.`actor_id` = NEW.`requester_actor_id` AND grant_revision.`status` = 'active' AND requester.`status` = 'active' AND organization.`status` = 'active' AND julianday(grant_revision.`valid_from`) <= julianday('now') AND (grant_revision.`valid_until` IS NULL OR julianday(grant_revision.`valid_until`) > julianday('now'))
)
	OR julianday(NEW.`requested_at`) > julianday('now') OR julianday(NEW.`expires_at`) <= julianday('now')
BEGIN
	SELECT RAISE(ABORT, 'tenant export request requires the exact current compliance grant');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_requests_update_guard` BEFORE UPDATE ON `tenant_export_requests` BEGIN SELECT RAISE(ABORT, 'tenant export requests are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_requests_delete_guard` BEFORE DELETE ON `tenant_export_requests` BEGIN SELECT RAISE(ABORT, 'tenant export requests are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_request_dossiers_insert_guard`
BEFORE INSERT ON `tenant_export_request_dossiers`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `tenant_export_request_state` WHERE `organization_id` = NEW.`organization_id` AND `export_request_id` = NEW.`export_request_id` AND `status` = 'pending')
BEGIN
	SELECT RAISE(ABORT, 'requested dossiers may only be frozen while the export request is pending');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_request_dossiers_update_guard` BEFORE UPDATE ON `tenant_export_request_dossiers` BEGIN SELECT RAISE(ABORT, 'requested dossier sets are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_request_dossiers_delete_guard` BEFORE DELETE ON `tenant_export_request_dossiers` BEGIN SELECT RAISE(ABORT, 'requested dossier sets are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_approval_records_insert_guard`
BEFORE INSERT ON `tenant_export_approval_records`
FOR EACH ROW
WHEN NOT EXISTS (SELECT 1 FROM `tenant_export_request_state` WHERE `organization_id` = NEW.`organization_id` AND `export_request_id` = NEW.`export_request_id` AND `status` = 'pending')
BEGIN
	SELECT RAISE(ABORT, 'approvals may only be appended while the export request is pending');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_approval_records_update_guard` BEFORE UPDATE ON `tenant_export_approval_records` BEGIN SELECT RAISE(ABORT, 'tenant export approvals are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_approval_records_delete_guard` BEFORE DELETE ON `tenant_export_approval_records` BEGIN SELECT RAISE(ABORT, 'tenant export approvals are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_request_state_insert_guard`
BEFORE INSERT ON `tenant_export_request_state`
FOR EACH ROW
WHEN NEW.`status` <> 'pending' OR NEW.`authorization_version` <> 1 OR NEW.`approval_set_sha256` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'tenant export request state must begin pending at version one');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_request_state_update_guard`
BEFORE UPDATE ON `tenant_export_request_state`
FOR EACH ROW
WHEN NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`export_request_id` IS NOT OLD.`export_request_id` OR NEW.`authorization_version` <> OLD.`authorization_version` + 1
	OR NOT ((OLD.`status` = 'pending' AND NEW.`status` IN ('approved', 'rejected', 'expired')) OR (OLD.`status` = 'approved' AND NEW.`status` = 'consumed'))
	OR (NEW.`status` = 'approved' AND ((SELECT count(*) FROM `tenant_export_request_dossiers` WHERE `organization_id` = NEW.`organization_id` AND `export_request_id` = NEW.`export_request_id`) <> (SELECT `expected_dossier_count` FROM `tenant_export_requests` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`export_request_id`) OR (SELECT count(*) FROM `tenant_export_approval_records` WHERE `organization_id` = NEW.`organization_id` AND `export_request_id` = NEW.`export_request_id`) <> (SELECT `expected_dossier_count` FROM `tenant_export_requests` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`export_request_id`)))
BEGIN
	SELECT RAISE(ABORT, 'tenant export approval state is stale, incomplete, or not allowlisted');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_export_request_state_delete_guard` BEFORE DELETE ON `tenant_export_request_state` BEGIN SELECT RAISE(ABORT, 'tenant export approval state cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `tenant_sessions_insert_guard`
BEFORE INSERT ON `tenant_sessions`
FOR EACH ROW
WHEN NEW.`status` <> 'active' OR NEW.`session_version` <> 1
	OR julianday(NEW.`issued_at`) > julianday('now') OR julianday(NEW.`expires_at`) <= julianday('now')
	OR NOT EXISTS (SELECT 1 FROM `organizations` WHERE `id` = NEW.`organization_id` AND `status` = 'active' AND `authorization_version` = NEW.`organization_authorization_version`)
	OR NOT EXISTS (SELECT 1 FROM `organization_memberships` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`membership_id` AND `actor_id` = NEW.`actor_id` AND `status` = 'active' AND `authorization_version` = NEW.`membership_authorization_version`)
	OR NOT EXISTS (SELECT 1 FROM `organization_policy_current` WHERE `organization_id` = NEW.`organization_id` AND `policy_revision` = NEW.`policy_revision`)
	OR (NEW.`authentication_method` = 'entra_oidc' AND NOT EXISTS (SELECT 1 FROM `organization_identity_connections` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`identity_connection_id` AND `status` = 'active' AND `configuration_version` = NEW.`identity_configuration_version`))
BEGIN
	SELECT RAISE(ABORT, 'tenant session must bind exact current active authority versions');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_sessions_update_guard`
BEFORE UPDATE ON `tenant_sessions`
FOR EACH ROW
WHEN NEW.`id` IS NOT OLD.`id` OR NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`membership_id` IS NOT OLD.`membership_id` OR NEW.`actor_id` IS NOT OLD.`actor_id` OR NEW.`identity_connection_id` IS NOT OLD.`identity_connection_id` OR NEW.`authentication_method` IS NOT OLD.`authentication_method` OR NEW.`session_token_sha256` IS NOT OLD.`session_token_sha256` OR NEW.`organization_authorization_version` IS NOT OLD.`organization_authorization_version` OR NEW.`membership_authorization_version` IS NOT OLD.`membership_authorization_version` OR NEW.`policy_revision` IS NOT OLD.`policy_revision` OR NEW.`identity_configuration_version` IS NOT OLD.`identity_configuration_version` OR NEW.`issued_at` IS NOT OLD.`issued_at` OR NEW.`expires_at` IS NOT OLD.`expires_at`
	OR NEW.`session_version` <> OLD.`session_version` + 1 OR julianday(NEW.`last_seen_at`) < julianday(OLD.`last_seen_at`)
	OR NOT ((OLD.`status` = NEW.`status` AND OLD.`status` = 'active') OR (OLD.`status` = 'active' AND NEW.`status` IN ('revoked', 'expired')))
	OR (NEW.`status` = 'active' AND (
		julianday(NEW.`last_seen_at`) > julianday('now') OR julianday(NEW.`expires_at`) <= julianday('now')
		OR NOT EXISTS (SELECT 1 FROM `organizations` WHERE `id` = NEW.`organization_id` AND `status` = 'active' AND `authorization_version` = NEW.`organization_authorization_version`)
		OR NOT EXISTS (SELECT 1 FROM `organization_memberships` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`membership_id` AND `actor_id` = NEW.`actor_id` AND `status` = 'active' AND `authorization_version` = NEW.`membership_authorization_version`)
		OR NOT EXISTS (SELECT 1 FROM `organization_policy_current` WHERE `organization_id` = NEW.`organization_id` AND `policy_revision` = NEW.`policy_revision`)
		OR (NEW.`authentication_method` = 'entra_oidc' AND NOT EXISTS (SELECT 1 FROM `organization_identity_connections` WHERE `organization_id` = NEW.`organization_id` AND `id` = NEW.`identity_connection_id` AND `status` = 'active' AND `configuration_version` = NEW.`identity_configuration_version`))
	))
BEGIN
	SELECT RAISE(ABORT, 'tenant session bindings are immutable and updates require one version step');
END;
--> statement-breakpoint
CREATE TRIGGER `tenant_sessions_delete_guard` BEFORE DELETE ON `tenant_sessions` BEGIN SELECT RAISE(ABORT, 'tenant session evidence cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_key_rotation_state_insert_guard`
BEFORE INSERT ON `organization_key_rotation_state`
FOR EACH ROW
WHEN NEW.`current_version` <> 1 OR NEW.`rotation_version` <> 1 OR NEW.`phase` <> 'stable' OR julianday(NEW.`activated_at`) > julianday('now') OR julianday(NEW.`rotate_by`) <= julianday('now')
BEGIN
	SELECT RAISE(ABORT, 'key rotation state must begin stable at version one with a current rotation window');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_key_rotation_state_update_guard`
BEFORE UPDATE ON `organization_key_rotation_state`
FOR EACH ROW
WHEN NEW.`organization_id` IS NOT OLD.`organization_id` OR NEW.`purpose` IS NOT OLD.`purpose` OR NEW.`key_alias` IS NOT OLD.`key_alias`
	OR NEW.`rotation_version` <> OLD.`rotation_version` + 1
	OR NOT (
		(OLD.`phase` IN ('stable', 'completed') AND NEW.`phase` = 'preparing')
		OR (OLD.`phase` = 'preparing' AND NEW.`phase` IN ('rewrapping', 'rolled_back'))
		OR (OLD.`phase` = 'rewrapping' AND NEW.`phase` IN ('rewrapping', 'verifying', 'rollback_rewrapping', 'rolled_back'))
		OR (OLD.`phase` = 'verifying' AND NEW.`phase` IN ('verifying', 'completed', 'rollback_rewrapping', 'rolled_back'))
		OR (OLD.`phase` = 'rollback_rewrapping' AND NEW.`phase` IN ('rollback_rewrapping', 'rollback_verifying'))
		OR (OLD.`phase` = 'rollback_verifying' AND NEW.`phase` = 'rolled_back')
	)
	OR (NEW.`from_version` IS OLD.`from_version` AND NEW.`from_version` IS NOT NULL AND (NEW.`rewrap_total_count` <> OLD.`rewrap_total_count` OR NEW.`rewrapped_count` < OLD.`rewrapped_count` OR NEW.`new_version_write_count` < OLD.`new_version_write_count`))
	OR (OLD.`phase` = 'rollback_rewrapping' AND NEW.`rollback_rewrapped_new_version_writes` < OLD.`rollback_rewrapped_new_version_writes`)
	OR (NEW.`phase` <> 'completed' AND (NEW.`activated_at` IS NOT OLD.`activated_at` OR NEW.`rotate_by` IS NOT OLD.`rotate_by`))
	OR (NEW.`phase` = 'completed' AND (julianday(NEW.`activated_at`) <= julianday(OLD.`activated_at`) OR julianday(NEW.`rotate_by`) <= julianday(NEW.`activated_at`)))
BEGIN
	SELECT RAISE(ABORT, 'key rotation state is stale or not allowlisted');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_key_rotation_state_delete_guard` BEFORE DELETE ON `organization_key_rotation_state` BEGIN SELECT RAISE(ABORT, 'key rotation evidence cannot be deleted'); END;
--> statement-breakpoint

CREATE TRIGGER `organization_security_receipts_chain_guard`
BEFORE INSERT ON `organization_security_receipts`
FOR EACH ROW
WHEN (NEW.`sequence` = 1 AND (NEW.`previous_receipt_sha256` <> '0000000000000000000000000000000000000000000000000000000000000000' OR EXISTS (SELECT 1 FROM `organization_security_receipts` WHERE `organization_id` = NEW.`organization_id`)))
	OR (NEW.`sequence` > 1 AND (NEW.`sequence` <> COALESCE((SELECT max(`sequence`) + 1 FROM `organization_security_receipts` WHERE `organization_id` = NEW.`organization_id`), 1) OR NEW.`previous_receipt_sha256` IS NOT (SELECT `receipt_sha256` FROM `organization_security_receipts` WHERE `organization_id` = NEW.`organization_id` ORDER BY `sequence` DESC LIMIT 1)))
	OR (NEW.`sequence` > 1 AND julianday(NEW.`occurred_at`) < (SELECT julianday(`occurred_at`) FROM `organization_security_receipts` WHERE `organization_id` = NEW.`organization_id` ORDER BY `sequence` DESC LIMIT 1))
BEGIN
	SELECT RAISE(ABORT, 'security receipt chain is missing or divergent');
END;
--> statement-breakpoint
CREATE TRIGGER `organization_security_receipts_update_guard` BEFORE UPDATE ON `organization_security_receipts` BEGIN SELECT RAISE(ABORT, 'security receipts are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `organization_security_receipts_delete_guard` BEFORE DELETE ON `organization_security_receipts` BEGIN SELECT RAISE(ABORT, 'security receipts are append-only'); END;
