CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_email` text NOT NULL,
	`event_type` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_object_idx` ON `audit_events` (`object_type`,`object_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `case_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`case_id` text NOT NULL,
	`version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`reviewer_email` text,
	`reviewer_note` text DEFAULT '' NOT NULL,
	`submitted_at` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_drafts_user_case_version_uidx` ON `case_drafts` (`user_email`,`case_id`,`version`);--> statement-breakpoint
CREATE INDEX `case_drafts_status_idx` ON `case_drafts` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `case_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`case_version` text NOT NULL,
	`user_email` text NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`studio_fingerprint` text,
	`context_type` text DEFAULT 'case' NOT NULL,
	`context_id` text,
	`severity` text DEFAULT 'suggestion' NOT NULL,
	`suggested_correction` text DEFAULT '' NOT NULL,
	`citation_url` text,
	`status` text DEFAULT 'new' NOT NULL,
	`moderator_note` text DEFAULT '' NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `case_feedback_case_idx` ON `case_feedback` (`case_id`,`case_version`,`created_at`);--> statement-breakpoint
CREATE TABLE `case_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`case_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_subscriptions_user_case_uidx` ON `case_subscriptions` (`user_email`,`case_id`);--> statement-breakpoint
CREATE TABLE `case_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` text NOT NULL,
	`version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`studio_fingerprint` text,
	`parent_case_id` text,
	`parent_version` text,
	`parent_fingerprint` text,
	`change_summary` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_versions_case_version_uidx` ON `case_versions` (`case_id`,`version`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`current_version` text NOT NULL,
	`fingerprint` text NOT NULL,
	`title` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`practice_area` text NOT NULL,
	`sector` text NOT NULL,
	`difficulty` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`review_level` text DEFAULT 'canonical' NOT NULL,
	`author_name` text DEFAULT 'GENESIS: JURIS' NOT NULL,
	`reviewer_name` text DEFAULT 'Editorial review pending' NOT NULL,
	`legal_as_of` text,
	`summary` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`centrally_managed` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cases_classification_idx` ON `cases` (`jurisdiction`,`practice_area`,`difficulty`);--> statement-breakpoint
CREATE INDEX `cases_status_idx` ON `cases` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `update_reads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`update_id` integer NOT NULL,
	`user_email` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`update_id`) REFERENCES `updates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `update_reads_update_user_uidx` ON `update_reads` (`update_id`,`user_email`);--> statement-breakpoint
CREATE TABLE `updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'product' NOT NULL,
	`case_id` text,
	`target_jurisdictions` text DEFAULT '[]' NOT NULL,
	`target_practice_areas` text DEFAULT '[]' NOT NULL,
	`target_roles` text DEFAULT '[]' NOT NULL,
	`published_at` text,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `updates_published_idx` ON `updates` (`published_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`professional_role` text DEFAULT 'practitioner' NOT NULL,
	`organisation` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`practice_areas` text DEFAULT '[]' NOT NULL,
	`experience_level` text DEFAULT 'mid' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`product_updates` integer DEFAULT false NOT NULL,
	`case_updates` integer DEFAULT false NOT NULL,
	`research_invites` integer DEFAULT false NOT NULL,
	`communications_consent_at` text,
	`privacy_notice_version` text DEFAULT '2026-08-21' NOT NULL,
	`verified_practitioner` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uidx` ON `users` (`email`);
--> statement-breakpoint
INSERT INTO `cases` (`id`,`current_version`,`fingerprint`,`title`,`jurisdiction`,`practice_area`,`sector`,`difficulty`,`duration_minutes`,`status`,`review_level`,`author_name`,`reviewer_name`,`legal_as_of`,`summary`,`tags`,`centrally_managed`,`updated_at`) VALUES
('be_commercial_failed_erp_001','1.1.0','sha256-2a3c1c410c8108eea6a44225589594b784eb7c5fd8e173ca564273faec695415','Failed ERP Implementation','BE · Commercial','Commercial disputes','Technology / implementation','Advanced',45,'published','bundled_beta','GENESIS: JURIS','Expert review pending',NULL,'An ERP implementation dispute shaped by scope changes, acceptance language, causation, evidence, deadlines and layered remedies.','["ERP","evidence","litigation"]',1,'2026-08-21T00:00:00.000Z'),
('be_commercial_logistics_001','1.1.0','sha256-6c567481bf7c79b148800226d6dc832d6e640194b7587c96b8a9f46b91fdef40','Unpaid Logistics Invoices','BE · Commercial','Commercial recovery','Logistics','Intermediate',35,'published','bundled_beta','GENESIS','Expert review pending',NULL,'A freight and warehousing recovery matter involving service levels, detention charges and contractual surcharges.','["logistics","CMR","insolvency"]',1,'2026-08-21T00:00:00.000Z'),
('greenfire_first_72_hours','0.3.0','sha256-b131cace9de8bc9627e0642cc03a7ea5c9569cd536a05a6ae137ea51ce6cb279','GreenFire — The First 72 Hours','NL · Corporate / Regulatory','Environmental & crisis','Industrial / crisis','Intermediate',35,'published','bundled_beta','GENESIS: AI Juris','Expert review pending',NULL,'An industrial fire creates simultaneous criminal, regulatory, environmental, insurance and insolvency pressure.','["incident","regulatory","72h"]',1,'2026-08-21T00:00:00.000Z'),
('nl_food_safety_goldenshell_001','0.2.0','sha256-6ead6fc8b4f388493448d06d9e2a59b8b0efd2d0fa052c78ffaed3a133176606','GoldenShell — Recall at Dawn','NL · Food safety','Food safety & product recall','Food safety','Advanced',40,'published','bundled_beta','GENESIS: AI Juris','Expert review pending',NULL,'A cross-border food-safety recall requiring evidence preservation, coordinated notification and a defensible causation model.','["recall","traceability","claims"]',1,'2026-08-21T00:00:00.000Z'),
('us_environmental_desert_water_001','0.2.0','sha256-67cc3c6ebc23b29940c417ef5a5692ca22c1624b2a6c9d49b18b175e5cb6c1c8','Desert Water','US · Environmental','Environmental mass claims','Environmental / mass claims','Expert',50,'published','bundled_beta','GENESIS: AI Juris','Expert review pending',NULL,'A groundwater contamination matter focused on evidence, causation, filing deadlines, remedies and appeal posture.','["groundwater","causation","mass claims"]',1,'2026-08-21T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `case_versions` (`case_id`,`version`,`fingerprint`,`studio_fingerprint`,`parent_case_id`,`parent_version`,`parent_fingerprint`,`change_summary`,`payload`,`published_at`) VALUES
('be_commercial_failed_erp_001','1.0.0','ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8',NULL,NULL,NULL,NULL,'Legacy beta manifest retained for played-session compatibility','{"runtime":"legacy-bundled","bundle":"canonical-case-bundle.json"}','2026-08-20T00:00:00.000Z'),
('be_commercial_logistics_001','1.0.0','1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8',NULL,NULL,NULL,NULL,'Legacy beta manifest retained for played-session compatibility','{"runtime":"legacy-bundled","bundle":"canonical-case-bundle.json"}','2026-08-20T00:00:00.000Z'),
('greenfire_first_72_hours','0.2.0','173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438',NULL,NULL,NULL,NULL,'Legacy beta manifest retained for played-session compatibility','{"runtime":"legacy-bundled","bundle":"canonical-case-bundle.json"}','2026-08-20T00:00:00.000Z'),
('nl_food_safety_goldenshell_001','0.1.0','7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4',NULL,NULL,NULL,NULL,'Legacy beta manifest retained for played-session compatibility','{"runtime":"legacy-bundled","bundle":"canonical-case-bundle.json"}','2026-08-20T00:00:00.000Z'),
('us_environmental_desert_water_001','0.1.0','636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af',NULL,NULL,NULL,NULL,'Legacy beta manifest retained for played-session compatibility','{"runtime":"legacy-bundled","bundle":"canonical-case-bundle.json"}','2026-08-20T00:00:00.000Z'),
('be_commercial_failed_erp_001','1.1.0','sha256-2a3c1c410c8108eea6a44225589594b784eb7c5fd8e173ca564273faec695415',NULL,'be_commercial_failed_erp_001','1.0.0','ed3e67464797d8dcfd4acd90a2f3c0ab769fab1b9b7fc87c1a8857b43e2fd2f8','Bundled web-beta adaptation with authored metrics and clock','{"runtime":"bundled","bundle":"canonical-case-bundle.json"}','2026-08-21T00:00:00.000Z'),
('be_commercial_logistics_001','1.1.0','sha256-6c567481bf7c79b148800226d6dc832d6e640194b7587c96b8a9f46b91fdef40',NULL,'be_commercial_logistics_001','1.0.0','1c6a26a53f0a0d05161812787a0e36f342271b4f9f3bdd7afa9a5068f52a8dd8','Bundled web-beta adaptation with authored metrics and clock','{"runtime":"bundled","bundle":"canonical-case-bundle.json"}','2026-08-21T00:00:00.000Z'),
('greenfire_first_72_hours','0.3.0','sha256-b131cace9de8bc9627e0642cc03a7ea5c9569cd536a05a6ae137ea51ce6cb279',NULL,'greenfire_first_72_hours','0.2.0','173140f010723c50f580fe9fd4e91417d3a20f51ca0b5315d94e900c1bde2438','Bundled web-beta adaptation with authored metrics and clock','{"runtime":"bundled","bundle":"canonical-case-bundle.json"}','2026-08-21T00:00:00.000Z'),
('nl_food_safety_goldenshell_001','0.2.0','sha256-6ead6fc8b4f388493448d06d9e2a59b8b0efd2d0fa052c78ffaed3a133176606',NULL,'nl_food_safety_goldenshell_001','0.1.0','7b0d2d7f07e3d5cb61d951afaf80d43d014893696bb16632d1beae5074d18ba4','Bundled web-beta adaptation with authored metrics and clock','{"runtime":"bundled","bundle":"canonical-case-bundle.json"}','2026-08-21T00:00:00.000Z'),
('us_environmental_desert_water_001','0.2.0','sha256-67cc3c6ebc23b29940c417ef5a5692ca22c1624b2a6c9d49b18b175e5cb6c1c8',NULL,'us_environmental_desert_water_001','0.1.0','636e7b78ddccf01b23476e53ab77f3c8b0c82406be7c567afbd9f1edc41a28af','Bundled web-beta adaptation with authored metrics and clock','{"runtime":"bundled","bundle":"canonical-case-bundle.json"}','2026-08-21T00:00:00.000Z');
