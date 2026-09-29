ALTER TABLE `account_recovery_codes` ADD `consumed_by` text;
--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD `consumed_by` text;
--> statement-breakpoint
UPDATE `password_reset_tokens`
SET `used_at` = CURRENT_TIMESTAMP
WHERE `used_at` IS NULL
  AND `id` NOT IN (
    SELECT MAX(`id`) FROM `password_reset_tokens` WHERE `used_at` IS NULL GROUP BY `account_id`
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_active_account_uidx` ON `password_reset_tokens` (`account_id`) WHERE "password_reset_tokens"."used_at" is null;
