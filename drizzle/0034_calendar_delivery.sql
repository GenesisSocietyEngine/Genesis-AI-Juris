CREATE TABLE `calendar_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`scope` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`active` integer NOT NULL,
	`operation` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_owner` ON `calendar_feeds` (`organization_id`,`scope`,`owner`);--> statement-breakpoint
CREATE TABLE `calendar_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`scope` text NOT NULL,
	`item` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`operation` text NOT NULL,
	`digest` text NOT NULL,
	`due_at` text NOT NULL,
	`channel` text NOT NULL,
	`state` text NOT NULL,
	`dismissed` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`available_at` text NOT NULL,
	`first_attempt` text,
	`lease` text,
	`provider_id` text,
	`destination_hash` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_reminder_operation` ON `calendar_reminders` (`organization_id`,`sender`,`operation`,`recipient`);--> statement-breakpoint
CREATE INDEX `calendar_reminder_dispatch` ON `calendar_reminders` (`state`,`available_at`);--> statement-breakpoint
CREATE INDEX `calendar_reminder_inbox` ON `calendar_reminders` (`organization_id`,`scope`,`recipient`,`due_at`);--> statement-breakpoint
CREATE INDEX `calendar_reminder_outbox` ON `calendar_reminders` (`organization_id`,`scope`,`sender`,`due_at`);--> statement-breakpoint
CREATE TABLE `calendar_withdrawals` (
	`organization_id` text NOT NULL,
	`scope` text NOT NULL,
	`item` text NOT NULL,
	`due_date` text NOT NULL,
	`timing` text,
	`revision` integer NOT NULL,
	`stamp` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_withdrawal_item` ON `calendar_withdrawals` (`organization_id`,`scope`,`item`);--> statement-breakpoint
CREATE TRIGGER calendar_withdraw_organization_work_revisions AFTER INSERT ON organization_work_revisions BEGIN
  INSERT INTO calendar_withdrawals (organization_id,scope,item,due_date,timing,revision,stamp)
  SELECT NEW.organization_id,'firm',old.value->>'$.id',old.value->>'$.dueDate',old.value->>'$.timing',NEW.revision,NEW.occurred_at
  FROM json_each((SELECT plan FROM organization_work_revisions WHERE organization_id=NEW.organization_id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1),'$.items') old
  WHERE old.value->>'$.dueDate' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM json_each(NEW.plan,'$.items') n WHERE n.value->>'$.id'=old.value->>'$.id' AND n.value->>'$.dueDate' IS NOT NULL)
  ON CONFLICT(organization_id,scope,item) DO UPDATE SET due_date=excluded.due_date,timing=excluded.timing,revision=excluded.revision,stamp=excluded.stamp;
  UPDATE calendar_reminders SET state=CASE WHEN channel='email' AND first_attempt IS NOT NULL THEN 'unknown' ELSE 'cancelled' END,lease=NULL WHERE organization_id=NEW.organization_id AND scope='firm' AND state IN ('pending','ready') AND NOT EXISTS (SELECT 1 FROM json_each(NEW.plan,'$.items') n WHERE n.value->>'$.id'=calendar_reminders.item AND n.value->>'$.status'='open');
END;--> statement-breakpoint
CREATE TRIGGER calendar_withdraw_dossier_practice_revisions AFTER INSERT ON dossier_practice_revisions BEGIN
  INSERT INTO calendar_withdrawals (organization_id,scope,item,due_date,timing,revision,stamp)
  SELECT (SELECT organization_id FROM dossier_organization_bindings WHERE dossier_id=NEW.dossier_id),NEW.dossier_id,old.value->>'$.id',old.value->>'$.dueDate',old.value->>'$.timing',NEW.revision,NEW.occurred_at
  FROM json_each((SELECT plan FROM dossier_practice_revisions WHERE dossier_id=NEW.dossier_id AND revision<NEW.revision ORDER BY revision DESC LIMIT 1),'$.items') old
  WHERE old.value->>'$.dueDate' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM json_each(NEW.plan,'$.items') n WHERE n.value->>'$.id'=old.value->>'$.id' AND n.value->>'$.dueDate' IS NOT NULL)
  ON CONFLICT(organization_id,scope,item) DO UPDATE SET due_date=excluded.due_date,timing=excluded.timing,revision=excluded.revision,stamp=excluded.stamp;
  UPDATE calendar_reminders SET state=CASE WHEN channel='email' AND first_attempt IS NOT NULL THEN 'unknown' ELSE 'cancelled' END,lease=NULL WHERE organization_id=(SELECT organization_id FROM dossier_organization_bindings WHERE dossier_id=NEW.dossier_id) AND scope=NEW.dossier_id AND state IN ('pending','ready') AND NOT EXISTS (SELECT 1 FROM json_each(NEW.plan,'$.items') n WHERE n.value->>'$.id'=calendar_reminders.item AND n.value->>'$.status'='open');
END;--> statement-breakpoint
CREATE TRIGGER calendar_stop_organizations AFTER UPDATE ON organizations WHEN NEW.status!='active' BEGIN
  UPDATE calendar_feeds SET active=0,revision=revision+1 WHERE active=1 AND organization_id=NEW.id AND 1;
  UPDATE calendar_reminders SET state=CASE WHEN channel='email' AND first_attempt IS NOT NULL THEN 'unknown' ELSE 'cancelled' END,lease=NULL WHERE state IN ('ready','pending') AND organization_id=NEW.id AND 1;
END;--> statement-breakpoint
CREATE TRIGGER calendar_stop_organization_memberships AFTER UPDATE ON organization_memberships WHEN NEW.status!='active' OR NEW.role!=OLD.role BEGIN
  UPDATE calendar_feeds SET active=0,revision=revision+1 WHERE active=1 AND organization_id=NEW.organization_id AND owner=NEW.actor_id;
  UPDATE calendar_reminders SET state=CASE WHEN channel='email' AND first_attempt IS NOT NULL THEN 'unknown' ELSE 'cancelled' END,lease=NULL WHERE state IN ('ready','pending') AND organization_id=NEW.organization_id AND (sender=NEW.actor_id OR recipient=NEW.actor_id);
END;--> statement-breakpoint
CREATE TRIGGER calendar_stop_dossier_participants AFTER UPDATE ON dossier_participants WHEN NEW.status!='active' OR NEW.role!=OLD.role BEGIN
  UPDATE calendar_feeds SET active=0,revision=revision+1 WHERE active=1 AND scope=NEW.dossier_id AND owner=NEW.actor_id;
  UPDATE calendar_reminders SET state=CASE WHEN channel='email' AND first_attempt IS NOT NULL THEN 'unknown' ELSE 'cancelled' END,lease=NULL WHERE state IN ('ready','pending') AND scope=NEW.dossier_id AND (sender=NEW.actor_id OR recipient=NEW.actor_id);
END;--> statement-breakpoint
CREATE TRIGGER calendar_stop_dossiers AFTER UPDATE ON dossiers WHEN NEW.status IN ('closed','archived','declined','cancelled') AND OLD.status!=NEW.status BEGIN
  UPDATE calendar_feeds SET active=0,revision=revision+1 WHERE active=1 AND scope=NEW.id AND 1;
  UPDATE calendar_reminders SET state=CASE WHEN channel='email' AND first_attempt IS NOT NULL THEN 'unknown' ELSE 'cancelled' END,lease=NULL WHERE state IN ('ready','pending') AND scope=NEW.id AND 1;
END;
