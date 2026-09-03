ALTER TABLE `case_versions` ADD `source_custom_case_id` integer REFERENCES custom_cases(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `case_versions_source_custom_case_idx` ON `case_versions` (`source_custom_case_id`);--> statement-breakpoint
CREATE TRIGGER `custom_case_grants_block_private_insert`
BEFORE INSERT ON `custom_case_grants`
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`custom_case_id` AND `is_private` = true)
BEGIN
	SELECT RAISE(ABORT, 'private custom case cannot be shared');
END;--> statement-breakpoint
CREATE TRIGGER `custom_case_grants_block_private_update`
BEFORE UPDATE ON `custom_case_grants`
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`custom_case_id` AND `is_private` = true)
BEGIN
	SELECT RAISE(ABORT, 'private custom case cannot be shared');
END;--> statement-breakpoint
CREATE TRIGGER `case_versions_block_private_custom_source`
BEFORE INSERT ON `case_versions`
FOR EACH ROW
WHEN NEW.`source_custom_case_id` IS NOT NULL
	AND EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`source_custom_case_id` AND `is_private` = true)
BEGIN
	SELECT RAISE(ABORT, 'private custom case cannot be published');
END;--> statement-breakpoint
CREATE TRIGGER `case_versions_require_current_custom_source`
BEFORE INSERT ON `case_versions`
FOR EACH ROW
WHEN NEW.`source_custom_case_id` IS NOT NULL
	AND EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`source_custom_case_id` AND `is_private` = false)
	AND NOT EXISTS (
		SELECT 1 FROM `custom_cases`
		WHERE `id` = NEW.`source_custom_case_id`
			AND `is_private` = false
			AND `case_id` = NEW.`case_id`
			AND `current_version` = NEW.`version`
			AND `fingerprint` = NEW.`studio_fingerprint`
	)
BEGIN
	SELECT RAISE(ABORT, 'custom case publication source changed');
END;--> statement-breakpoint
CREATE TRIGGER `case_drafts_block_private_moderation`
BEFORE UPDATE OF `status`, `reviewer_email`, `reviewer_note`, `reviewed_at` ON `case_drafts`
FOR EACH ROW
WHEN NEW.`status` IN ('submitted', 'changes_requested', 'accepted', 'rejected')
	AND NEW.`custom_case_id` IS NOT NULL
	AND EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`custom_case_id` AND `is_private` = true)
BEGIN
	SELECT RAISE(ABORT, 'private custom case cannot enter the review workflow');
END;--> statement-breakpoint
CREATE TRIGGER `case_drafts_block_private_submission_insert`
BEFORE INSERT ON `case_drafts`
FOR EACH ROW
WHEN NEW.`status` = 'submitted'
	AND NEW.`custom_case_id` IS NOT NULL
	AND EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`custom_case_id` AND `is_private` = true)
BEGIN
	SELECT RAISE(ABORT, 'private custom case cannot enter the review workflow');
END;--> statement-breakpoint
CREATE TRIGGER `case_feedback_block_private_insert`
BEFORE INSERT ON `case_feedback`
FOR EACH ROW
WHEN NEW.`custom_case_id` IS NOT NULL
	AND NEW.`audience` != 'owner_private'
	AND EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`custom_case_id` AND `is_private` = true)
BEGIN
	SELECT RAISE(ABORT, 'private custom case feedback must remain owner-only');
END;--> statement-breakpoint
CREATE TRIGGER `case_feedback_block_private_moderation`
BEFORE UPDATE OF `status`, `moderator_note`, `resolved_at` ON `case_feedback`
FOR EACH ROW
WHEN NEW.`custom_case_id` IS NOT NULL
	AND (NEW.`audience` = 'owner_private'
		OR EXISTS (SELECT 1 FROM `custom_cases` WHERE `id` = NEW.`custom_case_id` AND `is_private` = true))
BEGIN
	SELECT RAISE(ABORT, 'private custom case feedback cannot be moderated centrally');
END;
